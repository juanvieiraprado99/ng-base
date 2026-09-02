{{TEST_IMPORT}}import { {{CLASS_NAME}} } from './{{FILE_STEM}}';

describe('{{CLASS_NAME}}', () => {
  const pipe = new {{CLASS_NAME}}();

  it('is created', () => {
    expect(pipe).toBeTruthy();
  });

  it('returns the value unchanged by default', () => {
    expect(pipe.transform('value')).toBe('value');
  });
});
