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
if (!fs.existsSync(distPath)) {
  fs.mkdirSync(distPath, { recursive: true });
}

// Создаем простой wrapper сервер для pkg
const wrapperPath = path.join(process.cwd(), 'dist', 'wrapper.js');
const wrapperContent = `const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Определяем путь к ресурсам (в .exe это __dirname)
const appPath = __dirname;
const standalonePath = path.join(appPath, '.next', 'standalone');

// Если standalone не найден, пытаемся найти рядом с exe
let serverPath;
if (fs.existsSync(standalonePath)) {
  serverPath = path.join(standalonePath, 'server.js');
} else {
  // Fallback: ищем рядом с exe
  const exeDir = path.dirname(process.execPath);
  serverPath = path.join(exeDir, '.next', 'standalone', 'server.js');
}

if (!fs.existsSync(serverPath)) {
  console.error('Error: Cannot find server.js');
  console.error('Looking in:', serverPath);
  process.exit(1);
}

// Запускаем сервер
process.chdir(path.dirname(serverPath));
require(serverPath);
`;

fs.writeFileSync(wrapperPath, wrapperContent);

// Копируем .next/standalone в dist
console.log('📦 Copying standalone build...');
const distStandalonePath = path.join(distPath, '.next', 'standalone');
if (fs.existsSync(distStandalonePath)) {
  execSync(`rmdir /S /Q "${distStandalonePath}"`, { shell: true });
}
execSync(`xcopy /E /I /Y "${standalonePath}" "${distStandalonePath}"`, { shell: true });

// Копируем статические файлы
const staticPath = path.join(process.cwd(), '.next', 'static');
const distStaticPath = path.join(distPath, '.next', 'static');
if (fs.existsSync(staticPath)) {
  if (fs.existsSync(distStaticPath)) {
    execSync(`rmdir /S /Q "${distStaticPath}"`, { shell: true });
  }
  execSync(`xcopy /E /I /Y "${staticPath}" "${distStaticPath}"`, { shell: true });
}

// Запускаем pkg
try {
  console.log('📦 Packaging with pkg...');
  execSync(`npx pkg "${wrapperPath}" --targets node18-win-x64 --output-path "${distPath}"`, {
    stdio: 'inherit',
    cwd: process.cwd()
  });
  
  // Переименовываем выходной файл
  const exePath = path.join(distPath, 'wrapper.exe');
  const finalExePath = path.join(distPath, 'gpon-simulator.exe');
  if (fs.existsSync(exePath)) {
    fs.renameSync(exePath, finalExePath);
    console.log(`✅ Executable created: ${finalExePath}`);
    console.log(`📁 Static files location: ${distStaticPath}`);
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
