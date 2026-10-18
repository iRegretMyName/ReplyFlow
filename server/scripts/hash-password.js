// Creates a passwordHash for server/config/staff-accounts.js.
//   npm run staff:hash
// The password is typed into the terminal (hidden) and never written to disk or
// to your shell history. Only the hash is printed.
import { hashPassword, MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH } from '../auth/passwords.js';

function promptHidden(question) {
  return new Promise((resolve, reject) => {
    const { stdin, stdout } = process;
    stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    let value = '';
    const done = (fn, arg) => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener('data', onData);
      stdout.write('\n');
      fn(arg);
    };
    function onData(chunk) {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n') return done(resolve, value);
        if (ch === '\u0003') return done(reject, new Error('Cancelled.'));
        if (ch === '\u007f' || ch === '\b') { value = value.slice(0, -1); continue; }
        if (ch >= ' ') value += ch;
      }
    }
    stdin.on('data', onData);
  });
}

async function readPasswords() {
  if (process.stdin.isTTY) {
    const first = await promptHidden('New password (hidden): ');
    const second = await promptHidden('Type it again:        ');
    return [first, second];
  }
  // Piped input (used by the tests): first line is the password, second line the confirmation.
  let text = '';
  for await (const chunk of process.stdin) text += chunk;
  const lines = text.split(/\r?\n/);
  return [lines[0] ?? '', lines[1] ?? lines[0] ?? ''];
}

try {
  const [password, confirm] = await readPasswords();
  if (password !== confirm) throw new Error('The two passwords did not match. Nothing was created.');
  if (password.length < MIN_PASSWORD_LENGTH) throw new Error(`Use at least ${MIN_PASSWORD_LENGTH} characters. A few random words joined together works well.`);
  if (password.length > MAX_PASSWORD_LENGTH) throw new Error(`Use at most ${MAX_PASSWORD_LENGTH} characters.`);
  const hash = await hashPassword(password);
  console.log('\nPaste this line into the account in server/config/staff-accounts.js:\n');
  console.log(`  passwordHash: '${hash}',\n`);
} catch (err) {
  console.error(`\n${err.message}\n`);
  process.exit(1);
}
