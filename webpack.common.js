const path = require('path');

module.exports = {
  entry: './src/renderer/index.tsx',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist/renderer')
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  module: {
    rules: [
      {
        test: /\.(png|svg|jpg|jpeg|gif)$/i,
        type: 'asset/resource',
      }
    ]
  }
}; 