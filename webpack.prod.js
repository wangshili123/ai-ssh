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
    minimize: true,
    usedExports: true,
    sideEffects: false,
    splitChunks: {
      chunks: 'all',
      minSize: 20000,
      maxSize: 244000,
      cacheGroups: {
        default: false,
        vendors: false,
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
          priority: 1,
          enforce: true
        },
        monaco: {
          test: /[\\/]node_modules[\\/]monaco-editor[\\/]/,
          name: 'monaco',
          chunks: 'all',
          priority: 10,
          enforce: true
        },
        antd: {
          test: /[\\/]node_modules[\\/](antd|@ant-design)[\\/]/,
          name: 'antd',
          chunks: 'all',
          priority: 8,
          enforce: true
        },
        echarts: {
          test: /[\\/]node_modules[\\/](echarts|echarts-for-react)[\\/]/,
          name: 'echarts',
          chunks: 'all',
          priority: 7,
          enforce: true
        },
        react: {
          test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
          name: 'react',
          chunks: 'all',
          priority: 9,
          enforce: true
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
      languages: ['typescript', 'javascript', 'json', 'shell'],
      features: [
        'coreCommands',
        'find',
        'clipboard'
      ],
      globalAPI: false
    }),
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify('production'),
      'process.env.TREE_SITTER_WASM_PATH': JSON.stringify('./wasm/tree-sitter.wasm')
    }),
    new webpack.IgnorePlugin({
      resourceRegExp: /^\.\/locale$/,
      contextRegExp: /moment$/
    }),
    new webpack.IgnorePlugin({
      resourceRegExp: /^\.\/lib\/codemirror$/
    }),
    new webpack.IgnorePlugin({
      resourceRegExp: /^codemirror$/
    }),
    new webpack.IgnorePlugin({
      resourceRegExp: /^\.\/locale$/,
      contextRegExp: /antd$/
    }),
    new webpack.IgnorePlugin({
      resourceRegExp: /^\.\/locale$/,
      contextRegExp: /dayjs$/
    }),

  ],
  externals: {
    'electron': 'commonjs electron',
    'better-sqlite3': 'commonjs better-sqlite3',
    'chokidar': 'commonjs chokidar',
    'readdirp': 'commonjs readdirp',
    'fs': 'commonjs fs',
    'path': 'commonjs path',
    'os': 'commonjs os',
    'ssh2': 'commonjs ssh2',
    'ssh2-sftp-client': 'commonjs ssh2-sftp-client',
    'tree-sitter': 'commonjs tree-sitter',
    'tree-sitter-bash': 'commonjs tree-sitter-bash',
    'web-tree-sitter': 'commonjs web-tree-sitter',
    'generic-pool': 'commonjs generic-pool'
  }
}); 