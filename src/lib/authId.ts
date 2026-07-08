const AUTH_EMAIL_DOMAIN = 'tradinglistnext.app';

export function usernameToEmail(username: string): string {
  return `${username.trim().toLowerCase()}@${AUTH_EMAIL_DOMAIN}`;
}

export function isValidUsername(username: string): boolean {
  return /^[a-z0-9_.-]{4,20}$/i.test(username.trim());
}

export function translateAuthError(code: string): string {
  switch (code) {
    case 'auth/email-already-in-use':
      return '이미 사용 중인 아이디입니다.';
    case 'auth/invalid-email':
      return '아이디는 영문/숫자/._- 4~20자로 입력해주세요.';
    case 'auth/weak-password':
      return '비밀번호는 6자 이상이어야 합니다.';
    case 'auth/user-not-found':
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
      return '아이디 또는 비밀번호가 올바르지 않습니다.';
    case 'auth/too-many-requests':
      return '시도가 너무 많습니다. 잠시 후 다시 시도해주세요.';
    default:
      return '오류가 발생했습니다. 다시 시도해주세요.';
  }
}
