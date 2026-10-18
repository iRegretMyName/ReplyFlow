// ─────────────────────────────────────────────────────────────────────────────
//  STAFF ACCOUNTS
//
//  This file is the only place accounts are created. There is no sign-up page
//  and no screen in the website that can add, change or list staff.
//  If a person is not listed here, they cannot sign in.
//
//  ADD SOMEONE
//    1. In a terminal, in the project folder, run:   npm run staff:hash
//    2. Type a password when asked (12+ characters; it is not shown on screen).
//    3. Copy the passwordHash line it prints into a new entry below.
//    4. Restart the server (stop it with Ctrl+C, then run npm run dev again).
//
//  CHANGE A PASSWORD   Run npm run staff:hash again, replace the passwordHash, restart.
//  STOP SOMEONE        Set  enabled: false  (or delete their entry), restart.
//                      Their open sessions end when the server restarts.
//
//  Never type a plain password into this file. A passwordHash is a one-way
//  scrambled version that cannot be turned back into the password. It is still
//  sensitive, so keep this project in a private repository.
//
//  Fields
//    id           short unique label, e.g. 'asha' (letters, numbers, - and _)
//    username     what the person types to sign in (a name or an email address)
//    displayName  how they appear in the app
//    role         'admin' can also edit Institute info (the facts the AI may state);
//                 'staff' can do everything else. Optional, defaults to 'staff'.
//    enabled      true or false. Optional, defaults to true.
//    passwordHash from  npm run staff:hash
// ─────────────────────────────────────────────────────────────────────────────

export default [
  // {
  //   id: 'asha',
  //   username: 'asha',
  //   displayName: 'Asha Verma',
  //   role: 'admin',
  //   enabled: true,
  //   passwordHash: 'scrypt$65536$8$2$…paste the output of npm run staff:hash here…',
  // },
  {
    id: 'bali',
    username: 'bali',
    displayName: 'Aaditya Bali',
    role: 'admin',
    enabled: true,
    passwordHash: 'scrypt$65536$8$2$CV5NZYmlH6-3Y1y9lPd4OA$SZ3xgRY34KgyjgrFYdV4HboLVN2eIrRBu_3XBS-yuHf7mhqi2IfWB-KgJusu_P9b1cc9WTJTHKvpT0NKTpcSkA',
  },
];
