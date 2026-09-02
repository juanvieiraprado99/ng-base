{{TEST_IMPORT}}import { TestBed } from '@angular/core/testing';
import { {{CLASS_NAME}} } from './{{FILE_STEM}}';

describe('{{CLASS_NAME}}', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('is created', () => {
    const directive = TestBed.runInInjectionContext(
      () => new {{CLASS_NAME}}(),
    );
    expect(directive).toBeTruthy();
  });
});
