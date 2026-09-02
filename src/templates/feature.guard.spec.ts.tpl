{{TEST_IMPORT}}import { TestBed } from '@angular/core/testing';
import { CanActivateFn } from '@angular/router';
import { {{FN_NAME}} } from './{{FILE_STEM}}';

describe('{{FN_NAME}}', () => {
  const runGuard: CanActivateFn = (...params) =>
    TestBed.runInInjectionContext(() => {{FN_NAME}}(...params));

  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('is created', () => {
    expect(runGuard).toBeTruthy();
  });
});
