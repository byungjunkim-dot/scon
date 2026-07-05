const weatherCodeToText = (code: number) => {
  const map: Record<number, string> = {
    0: '맑음',
    1: '대체로 맑음',
    2: '부분적으로 흐림',
    3: '흐림',
    45: '안개',
    48: '짙은 안개',
    51: '이슬비',
    53: '이슬비',
    55: '강한 이슬비',
    56: '어는 이슬비',
    57: '강한 어는 이슬비',
    61: '비',
    63: '비',
    65: '강한 비',
    66: '어는 비',
    67: '강한 어는 비',
    71: '눈',
    73: '눈',
    75: '강한 눈',
    77: '싸락눈',
    80: '소나기',
    81: '소나기',
    82: '강한 소나기',
    85: '눈 소나기',
    86: '강한 눈 소나기',
    95: '뇌우',
    96: '우박 동반 뇌우',
    99: '강한 우박 동반 뇌우',
  };

  return map[code] ?? '알 수 없음';
};

const getKstToday = () => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const year = parts.find(p => p.type === 'year')?.value;
  const month = parts.find(p => p.type === 'month')?.value;
  const day = parts.find(p => p.type === 'day')?.value;

  return `${year}-${month}-${day}`;
};

const buildQuery = (params: Record<string, string>) => {
  return new URLSearchParams(params).toString();
};

const formatValue = (
  value: number | string | null | undefined,
  unit: string,
  fallback = ''
) => {
  if (value === null || value === undefined || value === '') return fallback;
  return `${value}${unit}`;
};

const getDailyWeatherFromResponse = (
  data: any,
  targetDate: string,
  useCurrentTemperature: boolean
) => {
  const dates: string[] = data.daily?.time ?? [];
  const index = dates.indexOf(targetDate);

  if (index < 0) {
    throw new Error(`해당 날짜의 날씨 데이터가 없습니다: ${targetDate}`);
  }

  const maxTemp = data.daily?.temperature_2m_max?.[index];
  const minTemp = data.daily?.temperature_2m_min?.[index];
  const precipitation = data.daily?.precipitation_sum?.[index];
  const windSpeed = data.daily?.wind_speed_10m_max?.[index];
  const weatherCode = data.daily?.weather_code?.[index] ?? -1;

  const tempUnit = data.daily_units?.temperature_2m_max ?? '°C';
  const precipitationUnit = data.daily_units?.precipitation_sum ?? 'mm';
  const windUnit = data.daily_units?.wind_speed_10m_max ?? 'm/s';

  const currentTemp = data.current?.temperature_2m;
  const currentTempUnit = data.current_units?.temperature_2m ?? '°C';

  const averageTemp =
    typeof maxTemp === 'number' && typeof minTemp === 'number'
      ? Math.round(((maxTemp + minTemp) / 2) * 10) / 10
      : '';

  return {
    temperature:
      useCurrentTemperature && currentTemp !== undefined && currentTemp !== ''
        ? `${currentTemp}${currentTempUnit}`
        : formatValue(averageTemp, tempUnit),
    maxTemp: formatValue(maxTemp, tempUnit),
    minTemp: formatValue(minTemp, tempUnit),
    precipitation: formatValue(precipitation, precipitationUnit, '0mm'),
    windSpeed: formatValue(windSpeed, windUnit, '0m/s'),
    status: weatherCodeToText(weatherCode),
  };
};

const fetchForecastWeather = async (
  latitude: number,
  longitude: number,
  targetDate: string
) => {
  const query = buildQuery({
    latitude: String(latitude),
    longitude: String(longitude),
    current: 'temperature_2m',
    daily: [
      'temperature_2m_max',
      'temperature_2m_min',
      'precipitation_sum',
      'wind_speed_10m_max',
      'weather_code',
    ].join(','),
    wind_speed_unit: 'ms',
    timezone: 'Asia/Seoul',
    forecast_days: '16',
  });

  const url = `https://api.open-meteo.com/v1/forecast?${query}`;
  const res = await fetch(url);

  if (!res.ok) {
    console.error(`Forecast Weather API request failed: ${url}, status: ${res.status}`);
    throw new Error('예보 날씨 조회 실패');
  }

  const data = await res.json();
  const today = getKstToday();

  return getDailyWeatherFromResponse(data, targetDate, targetDate === today);
};

const fetchHistoricalWeather = async (
  latitude: number,
  longitude: number,
  targetDate: string
) => {
  const query = buildQuery({
    latitude: String(latitude),
    longitude: String(longitude),
    start_date: targetDate,
    end_date: targetDate,
    daily: [
      'weather_code',
      'temperature_2m_max',
      'temperature_2m_min',
      'precipitation_sum',
      'wind_speed_10m_max',
    ].join(','),
    wind_speed_unit: 'ms',
    timezone: 'Asia/Seoul',
  });

  const url = `https://archive-api.open-meteo.com/v1/archive?${query}`;
  const res = await fetch(url);

  if (!res.ok) {
    console.error(`Historical Weather API request failed: ${url}, status: ${res.status}`);
    throw new Error('과거 날씨 조회 실패');
  }

  const data = await res.json();

  return getDailyWeatherFromResponse(data, targetDate, false);
};

export const fetchWeather = async (
  latitude: number,
  longitude: number,
  targetDate?: string
) => {
  const today = getKstToday();
  const date = targetDate || today;

  if (date < today) {
    return fetchHistoricalWeather(latitude, longitude, date);
  }

  return fetchForecastWeather(latitude, longitude, date);
};