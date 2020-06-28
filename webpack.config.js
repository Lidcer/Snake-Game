module.exports = {
  //mode: 'development',
  mode: "production",
  entry: {
    content: "./src/index.ts"
  },
  output: {
    path: __dirname,
    filename: `./public/injectable.js`
  },
  resolve: {
    extensions: ["*", ".js", ".ts"]
  },
  module: {
    rules: [{
      test: /\.(js|ts)$/,
      exclude: /node_modules/,
      loaders: ["ts-loader"]
    }]
  }
};