import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

window.addEventListener('load', () => {
  console.log('Window LOAD event fired.');
});

console.log('main.tsx executing...');

window.onerror = function(msg, url, line, col, error) {
  console.error('GLOBAL ERROR:', msg, url, line, error);
  alert('App Error: ' + msg);
  return false;
};
window.addEventListener('unhandledrejection', function(event) {
  console.error('UNHANDLED PROMISE REJECTION:', event.reason);
  alert('Promise Error: ' + event.reason);
});

try {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  console.log('React render() called successfully.');
} catch (err) {
  console.error('CRITICAL RENDER ERROR:', err);
  document.getElementById('root')!.innerHTML = '<div style="color:red;padding:20px;">Render Error: ' + err + '</div>';
}
