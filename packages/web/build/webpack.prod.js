const { merge } = require('webpack-merge');
const TerserPlugin = require('terser-webpack-plugin');
const ScriptExtHtmlPlugin = require('script-ext-html-webpack-plugin');
const WorkboxPlugin = require('workbox-webpack-plugin');
const WebpackBar = require('webpackbar');
const common = require('./webpack.common.js');

module.exports = merge(common, {
    mode: 'production',
    output: {
        publicPath: process.env.PublicPath || '/',
    },
    devtool: false,
    optimization: {
        minimize: true,
        minimizer: [
            new TerserPlugin({
                terserOptions: {
                    format: {
                        comments: false,
                    },
                },
                extractComments: false,
            }),
        ],
    },
    plugins: [
        new ScriptExtHtmlPlugin({
            custom: [
                {
                    test: /\.js$/,
                    attribute: 'crossorigin',
                    value: 'anonymous',
                },
            ],
        }),
        new WorkboxPlugin.GenerateSW({
            clientsClaim: true,
            skipWaiting: true,
            // 禁用缓存策略，确保更新后立即生效
            runtimeCaching: [],
            // 不缓存HTML，确保能获取最新版本
            exclude: [/\.html$/],
        }),
        new WebpackBar(),
    ],
});
