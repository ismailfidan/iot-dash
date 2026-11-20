import { execSync } from 'node:child_process';

function run(cmd, options = {}) {
  return execSync(cmd, { stdio: options.capture ? 'pipe' : 'inherit', encoding: 'utf8' });
}

try {
  // 1. Git deposu kontrolü
  try {
    run('git rev-parse --is-inside-work-tree', { capture: true });
  } catch {
    console.error('[npm run push] Hata: Bu klasör henüz bir Git deposu değil. Önce "git init" yapılmalıdır.');
    process.exit(1);
  }

  // 2. Remote origin kontrolü
  const remotes = run('git remote', { capture: true }).trim().split(/\r?\n/).filter(Boolean);
  if (!remotes.includes('origin')) {
    console.error('[npm run push] Hata: "origin" remote adresi tanımlı değil.');
    console.error('Örnek: git remote add origin https://github.com/KULLANICI/REPO.git');
    process.exit(1);
  }

  // 3. Tüm dosyaları sahneye al (.gitignore hariç)
  run('git add -A');

  // 4. Değişiklik varsa commit oluştur
  const status = run('git status --porcelain', { capture: true }).trim();
  if (status) {
    const customMsg = process.argv.slice(2).join(' ').trim();
    const now = new Date().toISOString().slice(0, 16).replace('T', ' ');
    const message = customMsg || `chore: dashboard guncellemesi (${now})`;
    const safeMsg = message.replace(/"/g, '\\"');
    run(`git commit -m "${safeMsg}"`);
  } else {
    console.log('[npm run push] Commit edilecek yeni değişiklik yok, mevcut dal gönderiliyor...');
  }

  // 5. GitHub'a gönder
  const branch = run('git branch --show-current', { capture: true }).trim() || 'main';
  run(`git push -u origin ${branch}`);
  console.log(`\n[npm run push] Tüm dosyalar başarıyla "origin/${branch}" dalına gönderildi.`);
} catch (err) {
  console.error('[npm run push] İşlem sırasında hata oluştu.');
  process.exit(err.status || 1);
}
