require('ts-node').register({
  compilerOptions: {
    module: 'commonjs'
  }
});

const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { localConfig } = require('./src/config/local.config');
const { merge } = require('webpack-merge');
const common = require('./webpack.common.js');

module.exports = merge(common, {
  mode: 'development',
  devtool: 'inline-source-map',
  target: 'electron-renderer',
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx']
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      },
      {
        test: /\.(png|svg|jpg|jpeg|gif)$/i,
        type: 'asset/resource',
      },
    ]
  },
  output: {
    filename: 'renderer.js',
    path: path.resolve(__dirname, 'dist/renderer'),
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/renderer/index.html'
    })
  ],
  devServer: {
    static: {
      directory: path.join(__dirname, 'dist/renderer'),
    },
    port: localConfig.devPort,
    hot: true,
  },
  resolve: {
    fallback: {
      "path": require.resolve("path-browserify"),
      "fs": false,
      "crypto": false
    }
  },
  externals: {
    'better-sqlite3': 'commonjs better-sqlite3'
  }
}); 