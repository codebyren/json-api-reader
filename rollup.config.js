import pkg from './package.json';
import typescript from 'rollup-plugin-typescript2';

// Extract "package-name" from "@author/package-name" for use as filename
const filename = pkg.name.split('/').pop();

// Convert filename "package-name" to "PackageName" for use as module name
const module_name = filename.split('-').map(word => word[0].toUpperCase() + word.substring(1)).join('');

// Another option for building the various modules:
// https://gist.github.com/jayphelps/51bafb4505558736fdba0aaf8bfe69d3

export default [
  // NOTE: The dist/tmp output is because I haven't managed
  // to get sourcemaps working when going directly from
  // typescript to compiled javascript. So, dist/tmp
  // is created first and then used as the source
  // for rollup to create modules + sourcemaps.
  {
    input: 'index.ts',
    output: {
      format: 'esm',
      exports: 'named',
      dir: 'dist/tmp',
    },
    plugins: [typescript()]
  },
  {
    input: 'dist/tmp/index.js',
    output: [
      {
        format: 'umd',
        name: module_name,
        file: `dist/umd/${filename}.js`,
        sourcemap: true,
      },
      {
        dir: 'dist/esm',
        format: 'esm',
        exports: 'named',
        sourcemap: true,
      },
      {
        dir: 'dist/cjs',
        format: 'cjs',
        exports: 'named',
        sourcemap: true,
      },
    ]
  },
]