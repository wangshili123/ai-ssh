const { merge } = require('webpack-merge');
const common = require('./webpack.common.js');
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');
const webpack = require('webpack');

module.exports = merge(common, {
  mode: 'production',
  target: 'electron-renderer',
  entry: {
    renderer: './src/renderer/index.tsx',
    editor: './src/renderer/editor-entry.tsx'
  },
  optimization: {
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
        },
        monaco: {
          test: /[\\/]node_modules[\\/]monaco-editor[\\/]/,
          name: 'monaco',
          chunks: 'all',
          priority: 10
        }
      }
    }
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.wasm']
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: {
          loader: 'ts-loader',
          options: {
            transpileOnly: true,
            compilerOptions: {
              skipLibCheck: true,
              skipDefaultLibCheck: true
            }
          }
        },
        exclude: /node_modules/
      },
      {
        test: /\.wasm$/,
        type: 'asset/resource',
        generator: {
          filename: 'wasm/[name][ext]'
        }
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
    filename: '[name].[contenthash].js',
    path: path.resolve(__dirname, 'dist/renderer'),
    publicPath: './',
    clean: true
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/renderer/index.html',
      filename: 'index.html',
      chunks: ['renderer', 'vendors', 'monaco']
    }),
    new HtmlWebpackPlugin({
      template: './src/renderer/editor.html',
      filename: 'editor.html',
      chunks: ['editor', 'vendors', 'monaco']
    }),
    new CopyWebpackPlugin({
      patterns: [
        {
          from: 'node_modules/web-tree-sitter/tree-sitter.wasm',
          to: 'wasm/'
        },
        {
          from: 'node_modules/tree-sitter-bash/tree-sitter-bash.wasm',
          to: 'wasm/'
        }
      ]
    }),
    new MonacoWebpackPlugin({
      languages: ['typescript', 'javascript', 'json'],
      features: ['!gotoSymbol', '!find', '!folding'] // 生产环境保留更多功能
    }),
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify('production'),
      'process.env.TREE_SITTER_WASM_PATH': JSON.stringify('./wasm/tree-sitter.wasm')
    })
  ],
  externals: {
    'electron': 'commonjs electron',
    'better-sqlite3': 'commonjs better-sqlite3',
    'chokidar': 'commonjs chokidar',
    'readdirp': 'commonjs readdirp',
    'fs': 'commonjs fs',
    'path': 'commonjs path',
    'os': 'commonjs os'
  }
}); 