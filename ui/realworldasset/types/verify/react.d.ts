declare namespace React {
  type ReactNode = any;
  type ReactElement = any;
  type HTMLAttributes<T> = Record<string, any>;
  type ButtonHTMLAttributes<T> = Record<string, any>;
  type InputHTMLAttributes<T> = Record<string, any>;
  type SelectHTMLAttributes<T> = Record<string, any>;
  type TableHTMLAttributes<T> = Record<string, any>;
  type ThHTMLAttributes<T> = Record<string, any>;
  type TdHTMLAttributes<T> = Record<string, any>;
  function forwardRef<T, P>(render: any): any;
  function useId(): string;
  function useState<T>(initial: T): [T, Dispatch<SetStateAction<T>>];
}
declare module "react" { export = React; }
declare namespace JSX { interface IntrinsicElements { [elemName: string]: any; } }
declare namespace React {
  type RefObject<T> = { current: T };
  function useEffect(effect: any, deps?: any[]): void;
  function useRef<T>(initial: T): RefObject<T>;
}
declare module "react-dom" { export function createPortal(children:any, container:any): any; }
declare namespace JSX { interface ElementChildrenAttribute { children: {}; } }
declare namespace React { type FormEvent<T = any> = any; }
declare namespace React {
  type SetStateAction<T> = T | ((prev:T)=>T);
  type Dispatch<T> = (value:T)=>void;
  const Fragment: any;
}
declare namespace JSX { interface IntrinsicAttributes { key?: any; } }
declare namespace React { const Suspense: any; }
