{{TEST_IMPORT}}import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form } from '@angular/forms/signals';
import { {{FN_NAME}}, type {{MODEL_NAME}} } from './{{FILE_STEM}}';

describe('{{FN_NAME}}', () => {
  it('rejects a name shorter than the minimum length', () => {
    const model = signal<{{MODEL_NAME}}>({ name: '' });
    const instance = TestBed.runInInjectionContext(() =>
      form(model, {{FN_NAME}}),
    );
    expect(instance().valid()).toBe(false);
  });

  it('accepts a valid name', () => {
    const model = signal<{{MODEL_NAME}}>({ name: 'Ada' });
    const instance = TestBed.runInInjectionContext(() =>
      form(model, {{FN_NAME}}),
    );
    expect(instance().valid()).toBe(true);
  });
});
