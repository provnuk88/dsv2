/**
 * Модуль валидатора кошельков для Synergy Guild Bot
 * Проверяет корректность форматов кошельков различных блокчейнов
 */

/**
 * Валидирует строку с кошельками в формате "СЕТЬ АДРЕС"
 * @param {string} walletsInput - Строка с кошельками, каждый на новой строке
 * @returns {Object} Результат валидации {isValid, errors, validWallets}
 */
function validateWallets(walletsInput) {
  // Если ввод пустой, считаем его валидным (необязательное поле)
  if (!walletsInput || walletsInput.trim() === '') {
    return { isValid: true, errors: [], validWallets: [] };
  }

  const lines = walletsInput.split('\n').filter(line => line.trim() !== '');
  const errors = [];
  const validWallets = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const lineNumber = i + 1;
    
    // Проверка формата "СЕТЬ АДРЕС"
    const parts = line.split(' ');
    if (parts.length < 2) {
      errors.push(`Строка ${lineNumber}: Неверный формат. Ожидается "СЕТЬ АДРЕС", например "ETH 0x123..."`);
      continue;
    }

    const chain = parts[0].toUpperCase();
    const address = parts.slice(1).join(' ').trim();

    // Проверка адреса на допустимые символы (A-F, a-f, 0-9)
    const addressWithoutPrefix = removePrefix(address);
    const isValidFormat = /^[a-fA-F0-9]{40,64}$/.test(addressWithoutPrefix);
    
    if (!isValidFormat) {
      errors.push(`Строка ${lineNumber}: Неверный формат адреса. Адрес должен содержать только символы A-F, a-f, 0-9 и иметь длину 40-64 символа.`);
      continue;
    }

    // Проверка на кастодиальные кошельки (упрощенная проверка)
    const isCustodial = checkIfCustodial(address, chain);
    if (isCustodial) {
      errors.push(`Строка ${lineNumber}: Обнаружен возможный кастодиальный кошелек (биржевой). Рекомендуется использовать некастодиальные кошельки.`);
      // Не прерываем проверку, просто предупреждаем
    }

    validWallets.push({ chain, address });
  }

  return {
    isValid: errors.length === 0,
    errors,
    validWallets
  };
}

/**
 * Удаляет префикс адреса (0x, ronin: и т.д.)
 * @param {string} address - Адрес кошелька
 * @returns {string} Адрес без префикса
 */
function removePrefix(address) {
  // Удаляем префикс 0x
  if (address.startsWith('0x')) {
    return address.substring(2);
  }
  
  // Удаляем префикс ronin:
  if (address.startsWith('ronin:')) {
    return address.substring(6);
  }
  
  // Другие возможные префиксы
  const prefixes = ['solana:', 'terra:', 'cosmos:'];
  for (const prefix of prefixes) {
    if (address.startsWith(prefix)) {
      return address.substring(prefix.length);
    }
  }
  
  return address;
}

/**
 * Проверяет, является ли адрес кастодиальным (биржевым)
 * @param {string} address - Адрес кошелька
 * @param {string} chain - Название блокчейна
 * @returns {boolean} true, если адрес похож на кастодиальный
 */
function checkIfCustodial(address, chain) {
  // Упрощенная проверка на известные адреса бирж
  // В реальном приложении здесь был бы более сложный алгоритм или API
  const knownExchangeAddresses = {
    'ETH': [
      '0x742d35cc6634c0532925a3b844bc454e4438f44e', // Binance
      '0x2faf487a4414fe77e2327f0bf4ae2a264a776ad2', // FTX
      '0xc098b2a3aa256d2140208c3de6543aaef5cd3a94'  // Coinbase
    ],
    'BTC': [
      'bc1qm34lsc65zpw79lxes69zkqmk6ee3ewf0j77s3h',
      '1LQoWist8KkaUXSPKZHNvEyfrEkPHzSsCd'
    ]
  };

  // Проверяем, есть ли адрес в списке известных биржевых адресов
  if (knownExchangeAddresses[chain] && 
      knownExchangeAddresses[chain].includes(address.toLowerCase())) {
    return true;
  }

  // Дополнительные эвристики могут быть добавлены здесь
  
  return false;
}

module.exports = {
  validateWallets
};
