'use client';

import { useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { FirebaseError } from 'firebase/app';
import { useAuth } from '@/context/AuthContext';
import { isValidUsername, translateAuthError } from '@/lib/authId';

const LOGIN_HINT_KEY = 'tradinglist_login_hint_dismissed';

function UserIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  );
}

export function UserButton() {
  const { currentUser, loading, logOut } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [hintDismissed, setHintDismissed] = useState(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem(LOGIN_HINT_KEY) === 'true';
  });

  if (loading) return null;

  const handleClick = () => {
    if (currentUser) {
      setMenuOpen((v) => !v);
    } else {
      setModalOpen(true);
    }
  };

  const dismissHint = () => {
    localStorage.setItem(LOGIN_HINT_KEY, 'true');
    setHintDismissed(true);
  };

  const showHint = !currentUser && !hintDismissed && !modalOpen;

  return (
    <div className="user-btn-wrap">
      <button
        type="button"
        className={`user-btn${currentUser ? ' active' : ''}`}
        onClick={handleClick}
        title={currentUser ? currentUser.displayName ?? '' : '로그인'}
        aria-label="계정"
      >
        <UserIcon />
      </button>

      {showHint && (
        <div className="login-hint" onClick={() => setModalOpen(true)}>
          <button
            type="button"
            className="login-hint__close"
            onClick={(e) => {
              e.stopPropagation();
              dismissHint();
            }}
            aria-label="닫기"
          >
            ✕
          </button>
          <p>
            로그인을 하여<br />모든 기기에서 데이터를 확인해보세요
          </p>
        </div>
      )}

      {menuOpen && currentUser && (
        <div className="user-menu">
          <div className="user-menu__name">{currentUser.displayName}</div>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              logOut();
              setMenuOpen(false);
            }}
          >
            로그아웃
          </button>
        </div>
      )}

      {modalOpen &&
        !currentUser &&
        createPortal(<AuthModal onClose={() => setModalOpen(false)} />, document.body)}
    </div>
  );
}

function AuthModal({ onClose }: { onClose: () => void }) {
  const { signUp, logIn } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const switchMode = (next: 'login' | 'signup') => {
    setMode(next);
    setError('');
    setPassword('');
    setPasswordConfirm('');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!isValidUsername(username)) {
      setError('아이디는 영문/숫자/._- 4~20자로 입력해주세요.');
      return;
    }
    if (password.length < 6) {
      setError('비밀번호는 6자 이상이어야 합니다.');
      return;
    }
    if (mode === 'signup' && password !== passwordConfirm) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'signup') {
        await signUp(username, password);
      } else {
        await logIn(username, password);
      }
      onClose();
    } catch (err) {
      const code = err instanceof FirebaseError ? err.code : '';
      setError(translateAuthError(code));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="auth-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form className="auth-card card" onSubmit={handleSubmit}>
        <button type="button" className="auth-modal-close" onClick={onClose} aria-label="닫기">
          ✕
        </button>

        <h1 className="auth-title">{mode === 'signup' ? '회원가입' : '로그인'}</h1>

        <div className="form-group">
          <label className="label" htmlFor="auth-username">아이디</label>
          <input
            id="auth-username"
            className="inp"
            type="text"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="영문/숫자 4~20자"
          />
        </div>

        <div className="form-group">
          <label className="label" htmlFor="auth-password">비밀번호</label>
          <input
            id="auth-password"
            className="inp"
            type="password"
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="6자 이상"
          />
        </div>

        {mode === 'signup' && (
          <div className="form-group">
            <label className="label" htmlFor="auth-password-confirm">비밀번호 확인</label>
            <input
              id="auth-password-confirm"
              className="inp"
              type="password"
              autoComplete="new-password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
            />
          </div>
        )}

        {error && <p className="auth-error">{error}</p>}

        <button className="btn-primary auth-submit" type="submit" disabled={submitting}>
          {submitting ? '처리 중...' : mode === 'signup' ? '가입하기' : '로그인'}
        </button>

        <button
          className="btn-ghost auth-switch"
          type="button"
          onClick={() => switchMode(mode === 'signup' ? 'login' : 'signup')}
        >
          {mode === 'signup' ? '이미 계정이 있으신가요? 로그인' : '계정이 없으신가요? 회원가입'}
        </button>
      </form>
    </div>
  );
}
