const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔨 Building executable...');

// Проверяем, что сборка Next.js завершена
const standalonePath = path.join(process.cwd(), '.next', 'standalone');
if (!fs.existsSync(standalonePath)) {
  console.error('❌ Error: .next/standalone not found. Run "npm run build" first.');
  process.exit(1);
}

// Создаем директорию для выходных файлов
const distPath = path.join(process.cwd(), 'dist');
// Полностью пересоздаем dist на каждый запуск, чтобы не тащить старые артефакты
if (fs.existsSync(distPath)) {
  execSync(`rmdir /S /Q "${distPath}"`, { shell: true });
}
fs.mkdirSync(distPath, { recursive: true });

// Создаем простой wrapper сервер для pkg
const wrapperPath = path.join(process.cwd(), 'dist', 'wrapper.js');
const wrapperContent = `const path = require('path');
const fs = require('fs');
const { createRequire } = require('module');

// Определяем путь к ресурсам (в .exe это __dirname)
const appPath = __dirname;

// Если standalone не найден рядом со скриптом, пытаемся найти рядом с exe
const localServerPath = path.join(appPath, '.next', 'standalone', 'server.js');
const exeDir = path.dirname(process.execPath);
const exeServerPath = path.join(exeDir, '.next', 'standalone', 'server.js');

const serverPath = fs.existsSync(localServerPath) ? localServerPath : exeServerPath;

if (!fs.existsSync(serverPath)) {
  console.error('Error: Cannot find server.js');
  console.error('Looking in:', serverPath);
  process.exit(1);
}

// Запускаем сервер (грузим с диска).
// Важно:
// - сохраняем literal require ('./server.js'), чтобы pkg не ругался на dynamic require
// - выставляем cwd в папку с server.js (standalone ожидает статику рядом)
const serverDir = path.dirname(serverPath);
process.chdir(serverDir);
const diskRequire = createRequire(serverPath);
diskRequire('./server.js');
`;

fs.writeFileSync(wrapperPath, wrapperContent);

// Копируем .next/standalone в dist
console.log('📦 Copying standalone build...');
const distStandalonePath = path.join(distPath, '.next', 'standalone');
if (fs.existsSync(distStandalonePath)) {
  execSync(`rmdir /S /Q "${distStandalonePath}"`, { shell: true });
}
execSync(`xcopy /E /I /Y "${standalonePath}" "${distStandalonePath}"`, { shell: true });

// Копируем статические файлы туда, где их ожидает standalone (./.next/standalone/.next/static)
const distStandaloneNextPath = path.join(distStandalonePath, '.next');
const distStandaloneStaticPath = path.join(distStandaloneNextPath, 'static');
fs.mkdirSync(distStandaloneNextPath, { recursive: true });

const staticPath = path.join(process.cwd(), '.next', 'static');
if (fs.existsSync(staticPath)) {
  if (fs.existsSync(distStandaloneStaticPath)) {
    execSync(`rmdir /S /Q "${distStandaloneStaticPath}"`, { shell: true });
  }
  execSync(`xcopy /E /I /Y "${staticPath}" "${distStandaloneStaticPath}"`, { shell: true });
}

// Копируем public рядом с standalone сервером (если есть)
const publicPath = path.join(process.cwd(), 'public');
const distStandalonePublicPath = path.join(distStandalonePath, 'public');
if (fs.existsSync(publicPath)) {
  fs.mkdirSync(distStandalonePublicPath, { recursive: true });
  execSync(`xcopy /E /I /Y "${publicPath}" "${distStandalonePublicPath}"`, { shell: true });
}

// Запускаем pkg
try {
  console.log('📦 Packaging with pkg...');
  // pkg supports either `--out-path` (directory) or `--output` (full output file path).
  // We use `--output` to guarantee the exe lands in /dist with a predictable name.
  const pkgOutputExePath = path.join(distPath, 'wrapper.exe');

  // Clean up any previous output to avoid false positives / wrong file locations
  if (fs.existsSync(pkgOutputExePath)) {
    fs.unlinkSync(pkgOutputExePath);
  }
  // pkg may previously have dropped the exe in project root; remove it so we don't accidentally pick it up
  const legacyRootExePath = path.join(process.cwd(), 'wrapper.exe');
  if (fs.existsSync(legacyRootExePath)) {
    fs.unlinkSync(legacyRootExePath);
  }

  execSync(`npx pkg "${wrapperPath}" --targets node18-win-x64 --output "${pkgOutputExePath}"`, {
    stdio: 'inherit',
    cwd: process.cwd()
  });
  
  // Переименовываем выходной файл
  let exePath = pkgOutputExePath;
  const finalExePath = path.join(distPath, 'gpon-simulator.exe');

  // Fallback: if pkg still emitted to some unexpected location, try to discover it.
  // (We've seen cases where wrong flags caused output to land in project root.)
  if (!fs.existsSync(exePath)) {
    const rootExePath = path.join(process.cwd(), 'wrapper.exe');
    if (fs.existsSync(rootExePath)) {
      fs.renameSync(rootExePath, exePath);
    }
  }

  if (fs.existsSync(finalExePath)) {
    fs.unlinkSync(finalExePath);
  }
  if (fs.existsSync(exePath)) {
    fs.renameSync(exePath, finalExePath);
    console.log(`✅ Executable created: ${finalExePath}`);
    console.log(`📁 Static files location: ${distStandaloneStaticPath}`);
    console.log(`⚠️  Note: The .exe file must be in the same directory as the .next folder`);
  } else {
    console.error('❌ Error: Executable not found after build');
    process.exit(1);
  }
} catch (error) {
  console.error('❌ Error building executable:', error.message);
  process.exit(1);
}

console.log('✨ Build complete!');
console.log('📝 To run: Execute gpon-simulator.exe from the dist folder');
