import type Browser from 'webextension-polyfill';

type CE = React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;

declare global {
  var browser: Browser.Browser;
  var chrome: Browser.Browser;
  namespace browser {
    namespace Runtime {
      type MessageSender = Browser.Runtime.MessageSender;
    }
    namespace Storage {
      type StorageChange = Browser.Storage.StorageChange;
    }
  }
  interface ImportMetaEnv {
    readonly DEV: boolean;
    readonly PROD: boolean;
  }
  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

declare module 'react' {
  interface ButtonHTMLAttributes<T> {
    primary?: string;
    danger?: string;
    secondary?: string;
    'step-btn'?: string;
    'is-settings'?: string;
  }
  interface DetailsHTMLAttributes<T> {
    shadow?: string;
  }
  interface InputHTMLAttributes<T> {
    invalid?: string;
  }
  namespace JSX {
    interface IntrinsicElements {
      'popup-container': CE;
      'toggle-row': CE;
      'toggle-switch': CE & { style?: React.CSSProperties };
      'toggle-label': CE;
      'status-display': CE & { variant?: string };
      'other-rules': CE;
      'rule-priority': CE;
      'options-container': CE;
      'card-section': CE;
      'model-item': CE;
      'model-info': CE;
      'model-name': CE;
      'model-labels': CE;
      'model-form': CE;
      'form-row': CE;
      'hint-text': CE & { style?: React.CSSProperties };
      'error-text': CE;
      'warning-text': CE;
      'label-edit-row': CE;
      'button-group': CE;
      'rule-item': CE & { disabled?: string; draggable?: boolean; onDragStart?: React.DragEventHandler; onDragOver?: React.DragEventHandler; onDragEnd?: React.DragEventHandler };
      'rule-header': CE;
      'drag-handle': CE;
      'rule-fields': CE;
      'validation-error': CE;
      'weight-sliders': CE;
      'weight-slider-row': CE;
      'label-name': CE;
      'weight-value': CE;
    }
  }
}
