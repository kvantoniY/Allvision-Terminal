import Cookies from 'js-cookie';

const COOKIE_NAME = 'av_token';

export const getToken = () => Cookies.get(COOKIE_NAME) || null;

export const setToken = (token) => {
  
  Cookies.set(COOKIE_NAME, token, {
    sameSite: 'lax',
    path: '/',
    // secure: true,
  });
};

export const clearToken = () => Cookies.remove(COOKIE_NAME, { path: '/' });
