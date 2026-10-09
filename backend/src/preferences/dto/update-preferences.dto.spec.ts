import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdatePreferencesDto } from './update-preferences.dto';

async function errorsFor(payload: Record<string, unknown>): Promise<string[]> {
  const dto = plainToInstance(UpdatePreferencesDto, payload);
  const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
  return errors.map((e) => e.property);
}

describe('UpdatePreferencesDto', () => {
  it('accepts an empty patch', async () => {
    expect(await errorsFor({})).toEqual([]);
  });

  it('accepts every whitelisted field with valid values', async () => {
    expect(
      await errorsFor({
        weekStartsOn: 'sunday',
        timezone: 'America/Argentina/Buenos_Aires',
        showWeeklySp: false,
        showSubtasks: true,
        showDependencies: false,
      }),
    ).toEqual([]);
  });

  it('accepts UTC and null (clears the timezone)', async () => {
    expect(await errorsFor({ timezone: 'UTC' })).toEqual([]);
    expect(await errorsFor({ timezone: null })).toEqual([]);
  });

  it('rejects a non-IANA timezone', async () => {
    expect(await errorsFor({ timezone: 'Mars/Olympus_Mons' })).toEqual(['timezone']);
    expect(await errorsFor({ timezone: '' })).toEqual(['timezone']);
    expect(await errorsFor({ timezone: '+03:00' })).toEqual(['timezone']);
  });

  it('rejects an unknown week start day', async () => {
    expect(await errorsFor({ weekStartsOn: 'wednesday' })).toEqual(['weekStartsOn']);
  });

  it('rejects non-boolean and null display flags', async () => {
    expect(await errorsFor({ showWeeklySp: 'yes' })).toEqual(['showWeeklySp']);
    expect(await errorsFor({ showSubtasks: null })).toEqual(['showSubtasks']);
  });

  it('rejects fields outside the whitelist, including userId', async () => {
    expect(await errorsFor({ userId: '00000000-0000-0000-0000-000000000000' })).toEqual(['userId']);
  });
});
