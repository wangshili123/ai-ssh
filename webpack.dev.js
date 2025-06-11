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
const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');

module.exports = merge(common, {
  mode: 'development',
  devtool: 'eval-cheap-module-source-map', // 更快的source map
  target: 'electron-renderer',
  cache: {
    type: 'filesystem',
    buildDependencies: {
      config: [__filename]
    },
    cacheDirectory: path.resolve(__dirname, '.webpack-cache')
  },
  optimization: {
    removeAvailableModules: false,
    removeEmptyChunks: false,
    splitChunks: false,
  },
  node: {
    __dirname: false,
    __filename: false
  },
  entry: {
    renderer: './src/renderer/index.tsx',
    editor: './src/renderer/editor-entry.tsx'
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
        use: {
          loader: 'ts-loader',
          options: {
            transpileOnly: true, // 只转译，不做类型检查，提升速度
            experimentalWatchApi: true, // 启用实验性监听API
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
    new HtmlWebpackPlugin({
      template: './src/renderer/editor.html',
      filename: 'editor.html',
      chunks: ['editor']
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
        },

      ]
    }),
    new webpack.ProvidePlugin({
      process: 'process/browser'
    }),
    new webpack.DefinePlugin({
      'process.env.TREE_SITTER_WASM_PATH': JSON.stringify('/wasm/tree-sitter.wasm')
    }),
    new MonacoWebpackPlugin({
      languages: ['typescript', 'javascript', 'json'], // 进一步减少语言包
      features: [
        '!accessibilityHelp',
        '!bracketMatching',
        '!caretOperations',
        '!clipboard',
        '!codeAction',
        '!codelens',
        '!colorDetector',
        '!comment',
        '!contextmenu',
        '!coreCommands',
        '!cursorUndo',
        '!dnd',
        '!find',
        '!folding',
        '!fontZoom',
        '!format',
        '!gotoError',
        '!gotoLine',
        '!gotoSymbol',
        '!hover',
        '!iPadShowKeyboard',
        '!inPlaceReplace',
        '!inspectTokens',
        '!linesOperations',
        '!links',
        '!multicursor',
        '!parameterHints',
        '!quickCommand',
        '!quickOutline',
        '!referenceSearch',
        '!rename',
        '!smartSelect',
        '!snippets',
        '!suggest',
        '!toggleHighContrast',
        '!toggleTabFocusMode',
        '!transpose',
        '!wordHighlighter',
        '!wordOperations',
        '!wordPartOperations'
      ]
    })
  ],
  devServer: {
    port: localConfig.devPort,
    hot: true,
    liveReload: false, // 禁用live reload，只使用HMR
    compress: false, // 开发环境禁用压缩
    client: {
      logging: 'warn' // 减少客户端日志
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
      },

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