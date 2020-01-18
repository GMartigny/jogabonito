const { resolve } = require("path");
const MiniCSSExtractPlugin = require("mini-css-extract-plugin");
const HTMLWebpackPlugin = require("html-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");

module.exports = {
    output: {
        path: resolve(__dirname, "public"),
    },
    module: {
        rules: [
            {
                test: /\.css$/,
                use: [
                    MiniCSSExtractPlugin.loader,
                    "css-loader",
                ],
            },
            {
                test: /\.png$/,
                use: "file-loader",
            },
        ],
    },
    plugins: [
        new MiniCSSExtractPlugin(),
        new HTMLWebpackPlugin({
            title: "Juggling",
        }),
        new CopyWebpackPlugin([
            {
                from: "./src/models",
                to: "./models",
            },
        ]),
    ],
    node: {
        fs: "empty",
    },
};
