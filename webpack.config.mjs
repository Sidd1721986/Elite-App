import path from 'path';
import { fileURLToPath } from 'url';
import * as Repack from '@callstack/repack';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Re.Pack + Hermes: transpile RN ecosystem packages under node_modules via Babel.
 * Do not use webpack DefinePlugin on __REACT_DEVTOOLS_GLOBAL_HOOK__ (breaks React).
 */
export default (env) => {
  const {
    mode = 'development',
    context = __dirname,
    platform,
    devServer,
  } = env;

  if (!platform) {
    throw new Error('Re.Pack: missing `platform` in webpack env');
  }

  process.env.BABEL_ENV = mode;

  const babelPreset = {
    loader: '@callstack/repack/babel-loader',
    options: {
      presets: ['module:@react-native/babel-preset'],
      sourceType: 'unambiguous',
    },
  };

  return {
    mode,
    devtool: false,
    context,
    entry: './index.js',
    resolve: {
      ...Repack.getResolveOptions(platform),
      fullySpecified: false,
      alias: {
        react: path.resolve(__dirname, 'node_modules/react'),
        'react-native': path.resolve(__dirname, 'node_modules/react-native'),
        'react/jsx-runtime': path.resolve(__dirname, 'node_modules/react/jsx-runtime'),
        '@react-native-vector-icons/material-design-icons': path.resolve(
          __dirname,
          'node_modules/react-native-vector-icons/MaterialCommunityIcons.js'
        ),
        'react-native-reanimated': path.resolve(__dirname, 'webpack-shims/reanimated-stub.js'),
      },
    },
    module: {
      rules: [
        {
          test: /\.[cm]?[jt]sx?$/,
          include: [
            ...Repack.getModulePaths([
              'react-native',
              '@react-native',
              '@react-navigation',
              '@react-navigation/elements',
              '@react-native-community',
              '@react-native-async-storage/async-storage',
              '@shopify/flash-list',
              'react-native-gesture-handler',
              'react-native-screens',
              'react-freeze',
              'react-native-safe-area-context',
              'react-native-paper',
              'react-native-fast-image',
              'react-native-image-picker',
              'react-native-vector-icons',
              'use-latest-callback',
              'color',
              '@callstack/repack',
            ]),
          ],
          use: babelPreset,
        },
        {
          test: /\.[jt]sx?$/,
          exclude: /node_modules/,
          use: babelPreset,
        },
        {
          test: Repack.getAssetExtensionsRegExp(Repack.ASSET_EXTENSIONS),
          use: {
            loader: '@callstack/repack/assets-loader',
            options: {
              platform,
              devServerEnabled: Boolean(devServer),
              scalableAssetExtensions: Repack.SCALABLE_ASSETS,
            },
          },
        },
      ],
    },
    output: {
      environment: {
        module: false,
      },
    },
    optimization: {
      concatenateModules: false,
    },
    plugins: [
      new Repack.RepackPlugin({
        context,
        mode,
        platform,
        devServer,
      }),
    ],
  };
};
