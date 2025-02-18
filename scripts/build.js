const esbuild = require('esbuild');

async function build() {
  try {
    await esbuild.build({
      entryPoints: ['./src/extension.ts'],
      bundle: true,
      outfile: 'dist/extension.js',
      external: [
        'vscode',
        // 将大型二进制模块设为外部依赖
        'sharp'
      ],
      platform: 'node',
      target: 'node14',
      format: 'cjs',
      minify: true,
      sourcemap: true,
      metafile: true
    });
    console.log('Build completed');
  } catch (err) {
    console.error('Build failed:', err);
    process.exit(1);
  }
}

build();