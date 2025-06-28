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
const CopyWebpackPlugin = require('copy-webpack-plugin');
const webpack = require('webpack');

module.exports = merge(common, {
  mode: 'development',
  devtool: false, // 禁用source map以提升速度
  target: 'electron-renderer',
  cache: {
    type: 'filesystem',
    buildDependencies: {
      config: [__filename]
    },
    cacheDirectory: path.resolve(__dirname, '.webpack-cache-fast')
  },
  optimization: {
    removeAvailableModules: false,
    removeEmptyChunks: false,
    splitChunks: false,
    minimize: false,
    usedExports: false,
    sideEffects: false
  },
  node: {
    __dirname: false,
    __filename: false
  },
  entry: {
    renderer: './src/renderer/index.tsx'
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
    fallback: {
      path: false,
      fs: false,
      crypto: false
    },
    symlinks: false
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: {
          loader: 'ts-loader',
          options: {
            transpileOnly: true,
            experimentalWatchApi: true,
            compilerOptions: {
              skipLibCheck: true,
              skipDefaultLibCheck: true,
              isolatedModules: true
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
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist/renderer'),
    publicPath: '/',
    assetModuleFilename: 'assets/[name][ext]'
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/renderer/index.html',
      filename: 'index.html',
      chunks: ['renderer']
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
    new webpack.ProvidePlugin({
      process: 'process/browser'
    }),
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify('development'),
      'process.env.TREE_SITTER_WASM_PATH': JSON.stringify('/wasm/tree-sitter.wasm')
    })
  ],
  devServer: {
    port: localConfig.devPort,
    hot: false, // 禁用热重载
    liveReload: false,
    compress: false,
    client: {
      logging: 'error'
    },
    static: [
      {
        directory: path.join(__dirname, 'dist/renderer'),
        publicPath: '/'
      },
      {
        directory: path.join(__dirname, 'node_modules/web-tree-sitter'),
        publicPath: '/wasm'
      },
      {
        directory: path.join(__dirname, 'node_modules/tree-sitter-bash'),
        publicPath: '/wasm'
      }
    ],
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    }
  },
  externals: {
    'electron': 'commonjs electron',
    'better-sqlite3': 'commonjs better-sqlite3',
    'chokidar': 'commonjs chokidar',
    'readdirp': 'commonjs readdirp',
    'fs': 'commonjs fs',
    'path': 'commonjs path',
    'os': 'commonjs os',
    'cpu-features': 'commonjs cpu-features',
    'monaco-editor': 'commonjs monaco-editor' // 外部化Monaco Editor
  }
});
