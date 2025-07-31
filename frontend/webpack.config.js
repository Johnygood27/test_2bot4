const path               = require('path');
const HtmlWebpackPlugin  = require('html-webpack-plugin');
const webpack            = require('webpack');

module.exports = {
  mode: 'development',
  entry: './src/main.js',  // всё тянется из main.js
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
    clean: true,
  },
  devServer: {
    static: './dist',
    port: 5173,
    hot: true,
  },
  experiments: {
    asyncWebAssembly: true,
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/index.html',
      inject: 'body',
      scriptLoading: 'blocking',
    }),
    new webpack.ProvidePlugin({
      global: require.resolve('globalthis'),
    }),
  ],
  resolve: {
    fallback: {
      buffer : require.resolve('buffer/'),
      events : require.resolve('events/'),
      stream : require.resolve('stream-browserify'),
      util   : require.resolve('util/'),
      process: require.resolve('process/browser'),
      crypto : false,
      fs     : false,
    },
  },
  module: {
    rules: [
      {
        test   : /\.js$/,
        use    : 'babel-loader',
        exclude: /node_modules|index\.html/,
      },
    ],
  },
};
