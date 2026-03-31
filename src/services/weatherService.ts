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
    61: '비',
    63: '비',
    65: '강한 비',
    71: '눈',
    73: '눈',
    75: '강한 눈',
    80: '소나기',
    81: '소나기',
    82: '강한 소나기',
    95: '뇌우',
  };

  return map[code] ?? '알 수 없음';
};

export const fetchWeather = async (
  latitude: number,
  longitude: number,
  targetDate?: string
) => {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${latitude}` +
    `&longitude=${longitude}` +
    `&current=temperature_2m` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,weather_code` +
    `&timezone=Asia/Seoul` +
    `&forecast_days=16`;

  const res = await fetch(url);

  if (!res.ok) {
    throw new Error('날씨 조회 실패');
  }

  const data = await res.json();

  const dates: string[] = data.daily?.time ?? [];
  const foundIndex = targetDate ? dates.indexOf(targetDate) : 0;
  const index = foundIndex >= 0 ? foundIndex : 0;

  const currentTemp = data.current?.temperature_2m ?? '';
  const currentTempUnit = data.current_units?.temperature_2m ?? '°C';

  const maxTemp = data.daily?.temperature_2m_max?.[index] ?? '';
  const minTemp = data.daily?.temperature_2m_min?.[index] ?? '';
  const precipitation = data.daily?.precipitation_sum?.[index] ?? '';
  const windSpeed = data.daily?.wind_speed_10m_max?.[index] ?? '';
  const weatherCode = data.daily?.weather_code?.[index] ?? -1;

  const tempUnit = data.daily_units?.temperature_2m_max ?? '°C';
  const precipitationUnit = data.daily_units?.precipitation_sum ?? 'mm';
  const windUnit = data.daily_units?.wind_speed_10m_max ?? '';

  return {
    temperature: currentTemp === '' ? '' : `${currentTemp}${currentTempUnit}`,
    maxTemp: maxTemp === '' ? '' : `${maxTemp}${tempUnit}`,
    minTemp: minTemp === '' ? '' : `${minTemp}${tempUnit}`,
    precipitation: precipitation === '' ? '' : `${precipitation}${precipitationUnit}`,
    windSpeed: windSpeed === '' ? '' : `${windSpeed}${windUnit}`,
    status: weatherCodeToText(weatherCode),
  };
};