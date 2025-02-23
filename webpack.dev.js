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
  devtool: 'inline-source-map',
  target: 'electron-renderer',
  node: {
    __dirname: false,
    __filename: false
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.wasm'],
    fallback: {
      path: false,
      fs: false,
      crypto: false
    }
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
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
        test: /tree-sitter\.js$/,
        use: [
          {
            loader: 'string-replace-loader',
            options: {
              multiple: [
                {
                  search: 'require\\([\'"]path[\'"]\\)',
                  replace: '(() => { return { normalize: (p) => p, join: (...args) => args.join("/") }; })()',
                  flags: 'g'
                },
                {
                  search: 'require\\([\'"]fs[\'"]\\)',
                  replace: '(() => { return { readFileSync: () => { throw new Error("fs not supported"); } }; })()',
                  flags: 'g'
                }
              ]
            }
          }
        ]
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      },
      {
        test: /\.(png|svg|jpg|jpeg|gif)$/i,
        type: 'asset/resource',
      },
    ],
    noParse: /tree-sitter\.wasm$/
  },
  output: {
    filename: 'renderer.js',
    path: path.resolve(__dirname, 'dist/renderer'),
    publicPath: '/',
    assetModuleFilename: 'assets/[name][ext]'
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/renderer/index.html'
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
      'process.env.TREE_SITTER_WASM_PATH': JSON.stringify('/wasm/tree-sitter.wasm')
    })
  ],
  devServer: {
    port: localConfig.devPort,
    hot: true,
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
    'os': 'commonjs os'
  }
}); 