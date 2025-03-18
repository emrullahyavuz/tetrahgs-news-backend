/**
 * Metin içeriğinden URL dostu slug oluşturur
 * @param {string} text - Slug'a dönüştürülecek metin
 * @returns {string} - URL dostu slug
 */
exports.createSlug = (text) => {
    return text
      .toString()
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-") // Boşlukları tire ile değiştir
      .replace(/[^\w-]+/g, "") // Alfanümerik olmayan karakterleri kaldır
      .replace(/--+/g, "-") // Birden fazla tireyi tek tire ile değiştir
      .replace(/^-+/, "") // Baştaki tireleri kaldır
      .replace(/-+$/, "") // Sondaki tireleri kaldır
  }
  
  /**
   * Sonuçları sayfalandırır
   * @param {Array} items - Sayfalandırılacak öğeler dizisi
   * @param {number} page - Mevcut sayfa numarası
   * @param {number} limit - Sayfa başına öğe sayısı
   * @returns {Object} - Sayfalandırılmış sonuçlar ve meta bilgiler
   */
  exports.paginateResults = (items, page = 1, limit = 10) => {
    const startIndex = (page - 1) * limit
    const endIndex = page * limit
  
    const results = {
      data: items.slice(startIndex, endIndex),
      pagination: {
        totalItems: items.length,
        totalPages: Math.ceil(items.length / limit),
        currentPage: Number.parseInt(page),
        limit: Number.parseInt(limit),
        hasNextPage: endIndex < items.length,
        hasPrevPage: startIndex > 0,
      },
    }
  
    return results
  }
  
  /**
   * Tarih formatını düzenler
   * @param {Date} date - Formatlanacak tarih
   * @param {string} locale - Dil ayarı (örn: 'tr-TR')
   * @returns {string} - Formatlanmış tarih
   */
  exports.formatDate = (date, locale = "tr-TR") => {
    return new Date(date).toLocaleDateString(locale, {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }
  
  /**
   * Metni belirli bir uzunlukta kısaltır
   * @param {string} text - Kısaltılacak metin
   * @param {number} length - Maksimum uzunluk
   * @returns {string} - Kısaltılmış metin
   */
  exports.truncateText = (text, length = 100) => {
    if (!text) return ""
    if (text.length <= length) return text
  
    return text.substring(0, length) + "..."
  }
  
  /**
   * Dosya adından MIME türünü belirler
   * @param {string} filename - Dosya adı
   * @returns {string} - MIME türü
   */
  exports.getMimeType = (filename) => {
    const extension = filename.split(".").pop().toLowerCase()
  
    const mimeTypes = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      pdf: "application/pdf",
      doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      xls: "application/vnd.ms-excel",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ppt: "application/vnd.ms-powerpoint",
      pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      mp3: "audio/mpeg",
      mp4: "video/mp4",
      txt: "text/plain",
    }
  
    return mimeTypes[extension] || "application/octet-stream"
  }
  
  /**
   * Rastgele bir dize oluşturur
   * @param {number} length - Oluşturulacak dizenin uzunluğu
   * @returns {string} - Rastgele dize
   */
  exports.generateRandomString = (length = 10) => {
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
    let result = ""
  
    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length))
    }
  
    return result
  }
  
  /**
   * Bir diziyi karıştırır (shuffle)
   * @param {Array} array - Karıştırılacak dizi
   * @returns {Array} - Karıştırılmış dizi
   */
  exports.shuffleArray = (array) => {
    const shuffled = [...array]
  
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
  
    return shuffled
  }
  
  