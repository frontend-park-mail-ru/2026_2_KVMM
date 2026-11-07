'use strict';

const path = require('node:path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');

const srcDir = path.resolve(__dirname, 'src');
const distDir = path.resolve(__dirname, 'dist');

module.exports = (env, argv) => {
    const isProduction = argv.mode === 'production';
    const hash = isProduction ? '.[contenthash:8]' : '';

    return {
        entry: path.join(srcDir, 'index.ts'),
        output: {
            path: distDir,
            publicPath: '/',
            filename: `assets/[name]${hash}.js`,
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
            }),
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
            proxy: [
                {
                    context: ['/api'],
                    target: process.env.BACKEND_URL || 'http://localhost:8080',
                    changeOrigin: true,
                },
            ],
        },
    };
};
