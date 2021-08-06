import { NgZone } from '@angular/core';
import { Observable, OperatorFunction } from 'rxjs';

export function closest(
  element: HTMLElement,
  selector?: string
): HTMLElement | null {
  if (!selector) {
    return null;
  }

  /*
   * In certain browsers (e.g. Edge 44.18362.449.0) HTMLDocument does
   * not support `Element.prototype.closest`. To emulate the correct behaviour
   * we return null when the method is missing.
   *
   * Note that in evergreen browsers `closest(document.documentElement, 'html')`
   * will return the document element whilst in Edge null will be returned. This
   * compromise was deemed good enough.
   */
  if (typeof element.closest === 'undefined') {
    return null;
  }

  return element.closest(selector);
}

/**
 * Creates an observable where all callbacks are executed inside a given zone
 *
 * @param zone
 */
export function runInZone<T>(zone: NgZone): OperatorFunction<T, T> {
  return (source) => {
    return new Observable((observer) => {
      const onNext = (value: T) => zone.run(() => observer.next(value));
      const onError = (e: any) => zone.run(() => observer.error(e));
      const onComplete = () => zone.run(() => observer.complete());
      return source.subscribe(onNext, onError, onComplete);
    });
  };
}

export function removeAccents(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
