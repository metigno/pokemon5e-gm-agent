export const MINUTES_PER_DAY = 24 * 60;
export const DEFAULT_START_MINUTE = 8 * 60;

const LEGACY_TIME_ANCHORS = {
  night: 0,
  morning: 8 * 60,
  afternoon: 14 * 60,
  evening: 19 * 60
};

export function daypartForMinute(minuteOfDay) {
  if (!Number.isInteger(minuteOfDay) || minuteOfDay < 0 || minuteOfDay >= MINUTES_PER_DAY) {
    throw new RangeError("minuteOfDay must be an integer from 0 to 1439");
  }
  if (minuteOfDay < 6 * 60) return "night";
  if (minuteOfDay < 12 * 60) return "morning";
  if (minuteOfDay < 18 * 60) return "afternoon";
  return "evening";
}

export function formatMinuteOfDay(minuteOfDay) {
  if (!Number.isInteger(minuteOfDay) || minuteOfDay < 0 || minuteOfDay >= MINUTES_PER_DAY) {
    throw new RangeError("minuteOfDay must be an integer from 0 to 1439");
  }
  const hours = Math.floor(minuteOfDay / 60);
  const minutes = minuteOfDay % 60;
  return String(hours).padStart(2, "0") + ":" + String(minutes).padStart(2, "0");
}

function inferLegacyMinute(world) {
  if (Number.isInteger(world.minuteOfDay) && world.minuteOfDay >= 0 && world.minuteOfDay < MINUTES_PER_DAY) {
    return world.minuteOfDay;
  }
  if (typeof world.time === "string" && Object.hasOwn(LEGACY_TIME_ANCHORS, world.time)) {
    return LEGACY_TIME_ANCHORS[world.time];
  }
  return DEFAULT_START_MINUTE;
}

export function ensureWorldClock(world) {
  if (!world || typeof world !== "object") throw new TypeError("world state is required");

  if (!Number.isInteger(world.elapsedMinutes) || world.elapsedMinutes < 0) {
    const day = Number.isInteger(world.day) && world.day >= 1 ? world.day : 1;
    world.elapsedMinutes = ((day - 1) * MINUTES_PER_DAY) + inferLegacyMinute(world);
  }

  world.day = Math.floor(world.elapsedMinutes / MINUTES_PER_DAY) + 1;
  world.minuteOfDay = world.elapsedMinutes % MINUTES_PER_DAY;
  world.time = daypartForMinute(world.minuteOfDay);
  return world;
}

export function advanceWorldTime(world, minutes) {
  if (!Number.isInteger(minutes) || minutes < 0) {
    throw new RangeError("Time cost must be a non-negative integer number of minutes");
  }
  ensureWorldClock(world);
  world.elapsedMinutes += minutes;
  return ensureWorldClock(world);
}

export function getWorldTimeView(world) {
  const snapshot = structuredClone(world);
  ensureWorldClock(snapshot);
  return {
    day: snapshot.day,
    elapsedMinutes: snapshot.elapsedMinutes,
    minuteOfDay: snapshot.minuteOfDay,
    time: snapshot.time,
    clock: formatMinuteOfDay(snapshot.minuteOfDay)
  };
}
