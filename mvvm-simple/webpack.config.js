const webpack = require('webpack');
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const {CleanWebpackPlugin} = require('clean-webpack-plugin');
const HardSourceWebpackPlugin = require('hard-source-webpack-plugin');

module.exports = {
    entry: {
        index: path.join(__dirname, './src/index.js')
    },
    output: {
        path: path.resolve('dist'),
        filename: '[name].js',
        publicPath: './',
    },
    mode: process.env.NODE_ENV,
    optimization: {
        minimize: false,
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                use: [
                    {
                        loader: 'thread-loader',
                        options: {
                          workers: 2,
                        },
                    },
                    {
                        loader: 'babel-loader',
                        options: {
                            presets: ['@babel/preset-env'],
                            plugins: ['@babel/plugin-proposal-class-properties']
                        },
                    },
                ]
            }
        ]
    },
    plugins: [
        process.env.NODE_ENV === 'development' ? (
            new webpack.HotModuleReplacementPlugin()
        ) : (
            new CleanWebpackPlugin(),
            new HardSourceWebpackPlugin()
        ),
        new HtmlWebpackPlugin({
            template: path.join(__dirname, `./src/index.html`),
            filename: `index.html`,
            chunks: ['index'],
            inject: true,
            minify: {
                html5: true,
                minifyJS: true,
                minifyCSS: true,
                removeComments: false,
                collapseWhitespace: true,
                preserveLineBreaks: false,
            },
        })
    ],
    devtool: process.env.NODE_ENV === 'development' ?
        '#eval-source-map' : false,
    devServer: process.env.NODE_ENV === 'development' ? {
        port: 8374,
        open: true,
        hot: true,
        contentBase: path.resolve('src'),
        openPage: `index.html`,
        index: `index.html`,
    } : {},
};
