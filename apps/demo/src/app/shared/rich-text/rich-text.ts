import { Pipe, PipeTransform } from '@angular/core';

/**
 * Escapes the text and turns `backticks` into <code>. Meant for [innerHTML],
 * which Angular still sanitizes. The content is our own static copy.
 */
@Pipe({ name: 'rich' })
export class RichText implements PipeTransform {
  transform(value: string): string {
    const escaped = value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;');
    return escaped.replace(/`([^`]+)`/g, '<code>$1</code>');
  }
}
