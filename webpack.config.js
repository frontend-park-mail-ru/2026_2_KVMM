'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const { DefinePlugin } = require('webpack');

const srcDir = path.resolve(__dirname, 'src');
const distDir = path.resolve(__dirname, 'dist');
const SW_FILE = 'sw.js';
const SW_MANIFEST = /(["'])__NEXLY_MANIFEST__\1/;

/**
 * Вписывает в service worker список файлов сборки и версию: воркер кеширует их при установке, а новая версия сборки заменяет старый кеш.
 */
class ServiceWorkerManifestPlugin {
    apply(compiler) {
        const { Compilation, sources } = compiler.webpack;
        compiler.hooks.thisCompilation.tap('ServiceWorkerManifest', (compilation) => {
            compilation.hooks.processAssets.tap(
                { name: 'ServiceWorkerManifest', stage: Compilation.PROCESS_ASSETS_STAGE_SUMMARIZE },
                (assets) => {
                    if (!assets[SW_FILE]) {
                        return;
                    }
                    const files = Object.keys(assets)
                        .filter((name) => name !== SW_FILE && !/\.(map|txt)$/.test(name))
                        .map((name) => `/${name}`)
                        .sort();
                    const version = crypto.createHash('sha256').update(files.join('\n')).digest('hex').slice(0, 12);
                    const manifest = JSON.stringify(JSON.stringify({ version, assets: files }));
                    const source = assets[SW_FILE].source().toString().replace(SW_MANIFEST, () => manifest);
                    compilation.updateAsset(SW_FILE, new sources.RawSource(source));
                },
            );
        });
    }
}

const backPublicDir = path.resolve(process.env.BACK_PUBLIC_DIR || path.join(__dirname, '..', 'back', 'pkg', 'public'));

module.exports = (env, argv) => {
    const isProduction = argv.mode === 'production';
    const hash = isProduction ? '.[contenthash:8]' : '';

    return {
        entry: {
            main: path.join(srcDir, 'index.ts'),
            sw: path.join(srcDir, 'sw', 'sw.ts'),
        },
        output: {
            path: distDir,
            publicPath: '/',
            filename: (pathData) => (pathData.chunk.name === 'sw' ? SW_FILE : `assets/[name]${hash}.js`),
            assetModuleFilename: 'assets/[name].[contenthash:8][ext]',
            clean: true,
        },
        devtool: isProduction ? 'source-map' : 'eval-cheap-module-source-map',
        resolve: {
            extensions: ['.ts', '.js'],
            alias: {
                '@': srcDir,
            },
        },
        module: {
            rules: [
                {
                    test: /\.ts$/,
                    include: srcDir,
                    type: 'javascript/auto',
                    use: 'babel-loader',
                },
                {
                    test: /\.scss$/,
                    use: [
                        MiniCssExtractPlugin.loader,
                        { loader: 'css-loader', options: { importLoaders: 2 } },
                        'postcss-loader',
                        'sass-loader',
                    ],
                },
                {
                    test: /\.(svg|png|jpe?g|gif|webp|woff2?)$/i,
                    type: 'asset/resource',
                },
            ],
        },
        plugins: [
            new HtmlWebpackPlugin({
                template: path.join(srcDir, 'index.html'),
                favicon: path.join(srcDir, 'components', 'Logo', 'logo.svg'),
                chunks: ['main'],
            }),
            new DefinePlugin({ SERVICE_WORKER: JSON.stringify(isProduction) }),
            new ServiceWorkerManifestPlugin(),
            new MiniCssExtractPlugin({
                filename: `assets/[name]${hash}.css`,
            }),
        ],
        optimization: {
            minimizer: [
                '...',
                new CssMinimizerPlugin({
                    minimizerOptions: { preset: ['default', { minifyGradients: false }] },
                }),
            ],
        },
        devServer: {
            port: Number(process.env.PORT) || 8001,
            historyApiFallback: true,
            static: fs.existsSync(backPublicDir) ? [{ directory: backPublicDir, publicPath: '/public' }] : false,
            proxy: [
                {
                    context: ['/api'],
                    target: process.env.BACKEND_URL || 'http://localhost:8080',
                    changeOrigin: true,
                    ws: true,
                },
            ],
        },
    };
};
