{{TEST_IMPORT}}import { TestBed } from '@angular/core/testing';
import { {{CLASS_NAME}} } from './{{FILE_STEM}}';

describe('{{CLASS_NAME}}', () => {
  let store: {{CLASS_NAME}};

  beforeEach(() => {
    TestBed.configureTestingModule({});
    store = TestBed.inject({{CLASS_NAME}});
  });

  it('starts out not loading', () => {
    expect(store.loading()).toBe(false);
    expect(store.ready()).toBe(true);
  });

  it('reflects setLoading', () => {
    store.setLoading(true);
    expect(store.loading()).toBe(true);
    expect(store.ready()).toBe(false);
  });
});
