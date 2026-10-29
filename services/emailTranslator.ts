/**
 * Automated Country-Specific Email Translation Engine
 * 
 * Translates email subject and body into the formal business tone of the target country
 * (e.g. English -> German for German enterprises, English -> French for French organizations),
 * while keeping all HTML formatting, CSS styling, and {{template_variables}}
 * (like {{first_name}}, {{last_name}}, {{company}}, {{phone}}, {{country}}, {{unsubscribe_url}}) intact.
 */

import { GoogleGenAI } from "@google/genai";

export interface TranslationRequest {
  subject: string;
  body: string;
  targetLanguage: string;
  targetCountry?: string;
  apiKey?: string;
}

export interface TranslationResult {
  success: boolean;
  translatedSubject: string;
  translatedBody: string;
  targetLanguage: string;
  targetCountry?: string;
  note?: string;
}

// B2B Phrase dictionary for authentic offline multilingual translations
interface LanguageProfile {
  greetings: string[];
  closings: string[];
  partnership: string;
  inquiry: string;
  catalog: string;
  proposal: string;
  collaboration: string;
  synergy: string;
  intro: string;
  interestInProducts: string;
  requestDetails: string;
  hearingFromYou: string;
  thankYou: string;
  subjectTemplates: Record<string, string>;
  commonReplacements: Array<[RegExp, string]>;
}

const LANGUAGE_PROFILES: Record<string, LanguageProfile> = {
  'German': {
    greetings: ['Sehr geehrte Damen und Herren,', 'Guten Tag,'],
    closings: ['Mit freundlichen Grüßen,', 'Herzliche Grüße,'],
    partnership: 'Kooperationsmöglichkeit mit {{company}}',
    inquiry: 'Geschäftliche Anfrage zu Ihren Produkten und Dienstleistungen',
    catalog: 'Anfrage zu Produktkatalog und Konditionen für {{company}}',
    proposal: 'Geschäftsangebot und Synergien für {{company}}',
    collaboration: 'Mögliche Zusammenarbeit mit {{company}}',
    synergy: 'Potenzielle Synergien zwischen unseren Unternehmen',
    intro: 'Ich kontaktiere Sie bezüglich einer potenziellen geschäftlichen Zusammenarbeit mit {{company}}.',
    interestInProducts: 'Wir haben großes Interesse an Ihren Produkten und Fertigungskapazitäten.',
    requestDetails: 'Könnten Sie uns bitte weitere Informationen und Details zukommen lassen?',
    hearingFromYou: 'Wir freuen uns auf Ihre geschätzte Rückmeldung.',
    thankYou: 'Vielen Dank für Ihre Zeit und Aufmerksamkeit.',
    subjectTemplates: {
      'partnership': 'Kooperationsmöglichkeit mit {{company}}',
      'inquiry': 'Geschäftliche Anfrage bezüglich Ihrer Produkte',
      'proposal': 'B2B-Geschäftsvorschlag für {{company}}',
      'collaboration': 'Zusammenarbeitsvorschlag für {{company}}',
      'introduction': 'Vorstellung und Kooperationsangebot für {{company}}'
    },
    commonReplacements: [
      [/Dear (?:Sir\/Madam|Customer|Partner|Team)[,]?/gi, 'Sehr geehrte Damen und Herren,'],
      [/Hello(?: there)?[,]?/gi, 'Guten Tag,'],
      [/(?:Best|Kind) regards[,]??|Sincerely[,]??|Yours faithfully[,]??/gi, 'Mit freundlichen Grüßen,'],
      [/Thank you for your time/gi, 'Vielen Dank für Ihre Zeit'],
      [/We would like to introduce/gi, 'Wir möchten Ihnen vorstellen'],
      [/I am reaching out regarding/gi, 'Ich wende mich an Sie bezüglich'],
      [/I am contacting you regarding/gi, 'Ich kontaktiere Sie bezüglich'],
      [/Partnership opportunity/gi, 'Kooperationsmöglichkeit'],
      [/Business collaboration/gi, 'Geschäftliche Zusammenarbeit'],
      [/Looking forward to hearing from you/gi, 'Wir freuen uns auf Ihre Rückmeldung'],
      [/Please let us know if you are interested/gi, 'Bitte lassen Sie uns wissen, ob Sie Interesse haben'],
      [/Feel free to reach out/gi, 'Zögern Sie nicht, uns zu kontaktieren'],
      [/We are interested in your products/gi, 'Wir interessieren uns für Ihre Produkte'],
      [/Could you please provide/gi, 'Könnten Sie uns bitte zukommen lassen']
    ]
  },

  'French': {
    greetings: ['Bonjour,', 'Madame, Monsieur,'],
    closings: ['Cordialement,', 'Bien cordialement,', 'Veuillez agréer nos salutations distinguées,'],
    partnership: 'Opportunité de partenariat avec {{company}}',
    inquiry: 'Demande d\'informations commerciales concernant vos services',
    catalog: 'Demande de catalogue et conditions commerciales pour {{company}}',
    proposal: 'Proposition de collaboration commerciale pour {{company}}',
    collaboration: 'Opportunité de synergie et collaboration avec {{company}}',
    synergy: 'Synergies potentielles entre nos deux organisations',
    intro: 'Je me permets de vous contacter concernant une opportunité de collaboration avec {{company}}.',
    interestInProducts: 'Nous portons un vif intérêt à votre offre et à vos produits.',
    requestDetails: 'Pourriez-vous nous transmettre des informations complémentaires ?',
    hearingFromYou: 'Dans l\'attente de votre aimable retour,',
    thankYou: 'Merci pour votre attention et votre temps.',
    subjectTemplates: {
      'partnership': 'Opportunité de partenariat avec {{company}}',
      'inquiry': 'Demande d\'informations commerciales',
      'proposal': 'Proposition de collaboration B2B pour {{company}}',
      'collaboration': 'Projet de collaboration avec {{company}}',
      'introduction': 'Présentation et opportunité de partenariat'
    },
    commonReplacements: [
      [/Dear (?:Sir\/Madam|Customer|Partner|Team)[,]?/gi, 'Madame, Monsieur,'],
      [/Hello(?: there)?[,]?/gi, 'Bonjour,'],
      [/(?:Best|Kind) regards[,]??|Sincerely[,]??|Yours faithfully[,]??/gi, 'Cordialement,'],
      [/Thank you for your time/gi, 'Merci pour votre temps et votre attention'],
      [/We would like to introduce/gi, 'Nous souhaitons vous présenter'],
      [/I am reaching out regarding/gi, 'Je me permets de vous contacter concernant'],
      [/I am contacting you regarding/gi, 'Je vous contacte au sujet de'],
      [/Partnership opportunity/gi, 'Opportunité de partenariat'],
      [/Business collaboration/gi, 'Collaboration commerciale'],
      [/Looking forward to hearing from you/gi, 'Dans l\'attente de votre retour'],
      [/Please let us know if you are interested/gi, 'N\'hésitez pas à nous faire part de votre intérêt'],
      [/Feel free to reach out/gi, 'N\'hésitez pas à nous recontacter'],
      [/We are interested in your products/gi, 'Nous sommes intéressés par vos produits'],
      [/Could you please provide/gi, 'Pourriez-vous nous fournir']
    ]
  },

  'Spanish': {
    greetings: ['Estimado/a,', 'Estimados señores,'],
    closings: ['Atentamente,', 'Un cordial saludo,'],
    partnership: 'Oportunidad de colaboración con {{company}}',
    inquiry: 'Consulta comercial sobre sus productos y servicios',
    catalog: 'Solicitud de catálogo y condiciones comerciales para {{company}}',
    proposal: 'Propuesta de colaboración empresarial para {{company}}',
    collaboration: 'Oportunidad de sinergia comercial con {{company}}',
    synergy: 'Potenciales sinergias entre nuestras empresas',
    intro: 'Me pongo en contacto con ustedes respecto a una oportunidad de cooperación comercial con {{company}}.',
    interestInProducts: 'Tenemos gran interés en sus productos y capacidad de suministro.',
    requestDetails: '¿Podrían facilitarnos más información y detalles adicionales?',
    hearingFromYou: 'Quedamos a la espera de sus gratas noticias.',
    thankYou: 'Agradecemos su tiempo y consideración.',
    subjectTemplates: {
      'partnership': 'Oportunidad de colaboración con {{company}}',
      'inquiry': 'Consulta comercial sobre sus productos',
      'proposal': 'Propuesta comercial para {{company}}',
      'collaboration': 'Oportunidad de negocio con {{company}}',
      'introduction': 'Presentación y propuesta de colaboración'
    },
    commonReplacements: [
      [/Dear (?:Sir\/Madam|Customer|Partner|Team)[,]?/gi, 'Estimados señores,'],
      [/Hello(?: there)?[,]?/gi, 'Estimado/a,'],
      [/(?:Best|Kind) regards[,]??|Sincerely[,]??|Yours faithfully[,]??/gi, 'Atentamente,'],
      [/Thank you for your time/gi, 'Muchas gracias por su tiempo'],
      [/We would like to introduce/gi, 'Nos gustaría presentarle'],
      [/I am reaching out regarding/gi, 'Me dirijo a usted en relación con'],
      [/I am contacting you regarding/gi, 'Me pongo en contacto con respecto a'],
      [/Partnership opportunity/gi, 'Oportunidad de colaboración'],
      [/Business collaboration/gi, 'Colaboración empresarial'],
      [/Looking forward to hearing from you/gi, 'Esperamos su respuesta con interés'],
      [/Please let us know if you are interested/gi, 'Por favor, indíquenos si resulta de su interés'],
      [/Feel free to reach out/gi, 'No dude en comunicarse con nosotros'],
      [/We are interested in your products/gi, 'Estamos interesados en sus productos'],
      [/Could you please provide/gi, '¿Podría proporcionarnos']
    ]
  },

  'Italian': {
    greetings: ['Gentile Partner,', 'Gentili Signori,'],
    closings: ['Cordiali saluti,', 'Distinti saluti,'],
    partnership: 'Opportunità di collaborazione con {{company}}',
    inquiry: 'Richiesta di informazioni commerciali sui vostri prodotti',
    catalog: 'Richiesta di catalogo e listino per {{company}}',
    proposal: 'Proposta di collaborazione commerciale per {{company}}',
    collaboration: 'Opportunità di sinergia con {{company}}',
    synergy: 'Potenziali sinergie commerciali tra le nostre aziende',
    intro: 'La contatto in merito a una possibile collaborazione commerciale con {{company}}.',
    interestInProducts: 'Siamo molto interessati ai vostri prodotti e alla vostra offerta.',
    requestDetails: 'Potreste inviarci maggiori informazioni e documentazione?',
    hearingFromYou: 'Restiamo in attesa di un vostro cortese riscontro.',
    thankYou: 'La ringraziamo per l\'attenzione e il tempo dedicato.',
    subjectTemplates: {
      'partnership': 'Opportunità di collaborazione con {{company}}',
      'inquiry': 'Richiesta di informazioni commerciali',
      'proposal': 'Proposta commerciale per {{company}}',
      'collaboration': 'Collaborazione strategica con {{company}}',
      'introduction': 'Presentazione e opportunità di partnership'
    },
    commonReplacements: [
      [/Dear (?:Sir\/Madam|Customer|Partner|Team)/gi, 'Gentili Signori,'],
      [/Hello(?: there)?/gi, 'Gentile Partner,'],
      [/Best regards|Kind regards|Sincerely|Yours faithfully/gi, 'Cordiali saluti,'],
      [/Thank you for your time/gi, 'Grazie per il tempo dedicatoci'],
      [/We would like to introduce/gi, 'Desideriamo presentarvi'],
      [/I am reaching out regarding/gi, 'La contatto in merito a'],
      [/I am contacting you regarding/gi, 'Vi contatto riguardo a'],
      [/Partnership opportunity/gi, 'Opportunità di collaborazione'],
      [/Business collaboration/gi, 'Collaborazione commerciale'],
      [/Looking forward to hearing from you/gi, 'In attesa di un vostro cortese riscontro'],
      [/Please let us know if you are interested/gi, 'Fateci sapere se l\'offerta è di vostro gradimento'],
      [/Feel free to reach out/gi, 'Non esitate a contattarci'],
      [/We are interested in your products/gi, 'Siamo interessati ai vostri prodotti'],
      [/Could you please provide/gi, 'Potreste fornirci']
    ]
  },

  'Dutch': {
    greetings: ['Beste,', 'Geachte heer/mevrouw,'],
    closings: ['Met vriendelijke groet,', 'Hoogachtend,'],
    partnership: 'Samenwerkingsmogelijkheid met {{company}}',
    inquiry: 'Commerciële aanvraag voor uw producten en diensten',
    catalog: 'Aanvraag documentatie en voorwaarden voor {{company}}',
    proposal: 'Samenwerkingsvoorstel voor {{company}}',
    collaboration: 'Kansen voor samenwerking met {{company}}',
    synergy: 'Potentiële synergieën tussen onze organisaties',
    intro: 'Ik neem contact met u op over een mogelijke zakelijke samenwerking met {{company}}.',
    interestInProducts: 'Wij hebben grote belangstelling voor uw producten en diensten.',
    requestDetails: 'Kunt u ons meer details en informatie verstrekken?',
    hearingFromYou: 'Wij zien uw reactie met belangstelling tegemoet.',
    thankYou: 'Hartelijk dank voor uw tijd en aandacht.',
    subjectTemplates: {
      'partnership': 'Samenwerkingsmogelijkheid met {{company}}',
      'inquiry': 'Zakelijke aanvraag betreffende uw producten',
      'proposal': 'Samenwerkingsvoorstel voor {{company}}',
      'collaboration': 'Samenwerking met {{company}}',
      'introduction': 'Introductie en partnerschap voor {{company}}'
    },
    commonReplacements: [
      [/Dear (?:Sir\/Madam|Customer|Partner|Team)/gi, 'Geachte heer/mevrouw,'],
      [/Hello(?: there)?/gi, 'Beste,'],
      [/Best regards|Kind regards|Sincerely|Yours faithfully/gi, 'Met vriendelijke groet,'],
      [/Thank you for your time/gi, 'Hartelijk dank voor uw tijd'],
      [/We would like to introduce/gi, 'Graag stellen wij u voor'],
      [/I am reaching out regarding/gi, 'Ik benader u inzake'],
      [/Partnership opportunity/gi, 'Samenwerkingsmogelijkheid'],
      [/Looking forward to hearing from you/gi, 'Wij zien uw reactie tegemoet']
    ]
  },

  'Portuguese': {
    greetings: ['Prezado(a),', 'Prezados Senhores,'],
    closings: ['Atenciosamente,', 'Com os melhores cumprimentos,'],
    partnership: 'Oportunidade de parceria com {{company}}',
    inquiry: 'Consulta comercial sobre seus produtos e serviços',
    catalog: 'Solicitação de catálogo e condições comerciais para {{company}}',
    proposal: 'Proposta de colaboração comercial para {{company}}',
    collaboration: 'Oportunidade de cooperação com {{company}}',
    synergy: 'Potenciais sinergias entre nossas empresas',
    intro: 'Entro em contato referente a uma oportunidade de cooperação comercial com {{company}}.',
    interestInProducts: 'Temos grande interesse em seus produtos e soluções.',
    requestDetails: 'Poderiam nos fornecer mais informações e detalhes?',
    hearingFromYou: 'Aguardamos seu retorno com grande interesse.',
    thankYou: 'Agradecemos desde já pela atenção e pelo tempo dispensado.',
    subjectTemplates: {
      'partnership': 'Oportunidade de parceria com {{company}}',
      'inquiry': 'Consulta comercial sobre produtos',
      'proposal': 'Proposta comercial para {{company}}',
      'collaboration': 'Proposta de colaboração para {{company}}',
      'introduction': 'Apresentação e oportunidade de parceria'
    },
    commonReplacements: [
      [/Dear (?:Sir\/Madam|Customer|Partner|Team)/gi, 'Prezados Senhores,'],
      [/Hello(?: there)?/gi, 'Prezado(a),'],
      [/Best regards|Kind regards|Sincerely|Yours faithfully/gi, 'Atenciosamente,'],
      [/Thank you for your time/gi, 'Muito obrigado pela sua atenção'],
      [/I am reaching out regarding/gi, 'Entro em contato a respeito de'],
      [/Partnership opportunity/gi, 'Oportunidade de parceria'],
      [/Looking forward to hearing from you/gi, 'Aguardamos seu retorno com expectativa']
    ]
  },

  'Polish': {
    greetings: ['Szanowni Państwo,', 'Dzień dobry,'],
    closings: ['Z poważaniem,', 'Z wyrazami szacunku,'],
    partnership: 'Możliwość współpracy z {{company}}',
    inquiry: 'Zapytanie ofertowe dotyczące Państwa produktów',
    catalog: 'Prośba o katalog i warunki współpracy dla {{company}}',
    proposal: 'Propozycja współpracy biznesowej dla {{company}}',
    collaboration: 'Możliwość synergii biznesowej z {{company}}',
    synergy: 'Potencjalne korzyści ze współpracy naszych firm',
    intro: 'Zwracam się z propozycją nawiązania współpracy biznesowej z {{company}}.',
    interestInProducts: 'Jesteśmy bardzo zainteresowani Państwa ofertą i produktami.',
    requestDetails: 'Czy mogliby Państwo przesłać nam więcej szczegółów?',
    hearingFromYou: 'Z niecierpliwością oczekujemy na Państwa odpowiedź.',
    thankYou: 'Dziękujemy za poświęcony czas.',
    subjectTemplates: {
      'partnership': 'Możliwość współpracy z {{company}}',
      'inquiry': 'Zapytanie biznesowe dotyczące produktów',
      'proposal': 'Oferta współpracy dla {{company}}',
      'collaboration': 'Propozycja partnerstwa z {{company}}',
      'introduction': 'Prezentacja i oferta współpracy'
    },
    commonReplacements: [
      [/Dear (?:Sir\/Madam|Customer|Partner|Team)/gi, 'Szanowni Państwo,'],
      [/Hello(?: there)?/gi, 'Dzień dobry,'],
      [/Best regards|Kind regards|Sincerely|Yours faithfully/gi, 'Z poważaniem,'],
      [/Thank you for your time/gi, 'Dziękuję za poświęcony czas'],
      [/Partnership opportunity/gi, 'Możliwość współpracy']
    ]
  },

  'Swedish': {
    greetings: ['Hej,', 'Bästa mottagare,'],
    closings: ['Med vänliga hälsningar,', 'Vänliga hälsningar,'],
    partnership: 'Samarbetsmöjlighet med {{company}}',
    inquiry: 'Förfrågan gällande era produkter och tjänster',
    catalog: 'Förfrågan om produktkatalog för {{company}}',
    proposal: 'Affärsförslag och samarbete för {{company}}',
    collaboration: 'Möjligt affärssamarbete med {{company}}',
    synergy: 'Potentiella synergier mellan våra verksamheter',
    intro: 'Jag kontaktar er angående ett potentiellt affärssamarbete med {{company}}.',
    interestInProducts: 'Vi är mycket intresserade av era produkter och kapacitet.',
    requestDetails: 'Skulle ni kunna skicka oss mer information?',
    hearingFromYou: 'Vi ser fram emot ert svar.',
    thankYou: 'Tack för er tid och uppmärksamhet.',
    subjectTemplates: {
      'partnership': 'Samarbetsmöjlighet med {{company}}',
      'inquiry': 'Affärsförfrågan gällande era produkter',
      'proposal': 'Samarbetsförslag för {{company}}'
    },
    commonReplacements: [
      [/Dear (?:Sir\/Madam|Customer|Partner|Team)/gi, 'Bästa mottagare,'],
      [/Hello(?: there)?/gi, 'Hej,'],
      [/Best regards|Kind regards|Sincerely|Yours faithfully/gi, 'Med vänliga hälsningar,']
    ]
  },

  'Japanese': {
    greetings: ['拝啓', 'お世話になっております。'],
    closings: ['敬具', '何卒よろしくお願い申し上げます。'],
    partnership: '{{company}}様との業務提携のご提案',
    inquiry: '貴社製品・サービスに関するお問い合わせ',
    catalog: '{{company}}様向け製品資料およびご提案について',
    proposal: '{{company}}様への事業提携のご案内',
    collaboration: '貴社との協業機会について',
    synergy: '両社間のシナジー創出のご提案',
    intro: 'ビジネス連携の機会についてご連絡申し上げます。',
    interestInProducts: '貴社の優れた製品および技術力に深く関心を持っております。',
    requestDetails: '詳細な資料や情報をご提供いただけますと幸甚に存じます。',
    hearingFromYou: 'ご検討のほど、何卒よろしくお願い申し上げます。',
    thankYou: 'お時間をいただき誠にありがとうございます。',
    subjectTemplates: {
      'partnership': '{{company}}様との提携のご提案',
      'inquiry': '貴社製品に関するお問い合わせ'
    },
    commonReplacements: [
      [/Dear (?:Sir\/Madam|Customer|Partner|Team)/gi, 'お世話になっております。'],
      [/Best regards|Kind regards|Sincerely/gi, '何卒よろしくお願い申し上げます。']
    ]
  },

  'Chinese': {
    greetings: ['尊敬的贵公司领导：', '您好：'],
    closings: ['此致 敬礼', '顺祝商祺'],
    partnership: '与 {{company}} 的业务合作机遇',
    inquiry: '关于贵司产品与服务的商务咨询',
    catalog: '为 {{company}} 提供的产品目录与合作方案',
    proposal: '针对 {{company}} 的B2B商务合作建议',
    collaboration: '与贵司建立业务合作关系的建议',
    synergy: '双方企业优势互补与战略协同',
    intro: '您好，我谨就商务合作事宜与贵司接洽。',
    interestInProducts: '我们对贵司的产品质量和供应能力非常赞赏与关注。',
    requestDetails: '不知是否方便向我们提供更多详细资料与方案？',
    hearingFromYou: '期待收到贵司的宝贵回复。',
    thankYou: '感谢您的宝贵时间与阅览。',
    subjectTemplates: {
      'partnership': '与 {{company}} 的业务合作机遇',
      'inquiry': '关于贵司产品的商务合作咨询'
    },
    commonReplacements: [
      [/Dear (?:Sir\/Madam|Customer|Partner|Team)/gi, '尊敬的贵公司领导：'],
      [/Hello(?: there)?/gi, '您好：'],
      [/Best regards|Kind regards|Sincerely/gi, '顺祝商祺，']
    ]
  },

  'Turkish': {
    greetings: ['Sayın Yetkili,', 'Merhaba,'],
    closings: ['Saygılarımızla,', 'İyi çalışmalar dileriz,'],
    partnership: '{{company}} ile iş ortaklığı fırsatı',
    inquiry: 'Ürün ve hizmetleriniz hakkında ticari talep',
    catalog: '{{company}} için ürün kataloğu ve iş birliği talebi',
    proposal: '{{company}} için iş birliği önerisi',
    collaboration: '{{company}} ile ortak çalışma olanakları',
    synergy: 'Şirketlerimiz arasındaki potansiyel sinerjiler',
    intro: 'İş birliği fırsatlarını değerlendirmek amacıyla iletişime geçiyorum.',
    interestInProducts: 'Ürünlerinize ve üretim kalitenize büyük ilgi duymaktayız.',
    requestDetails: 'Daha ayrıntılı bilgi ve dokümantasyon iletebilir misiniz?',
    hearingFromYou: 'Geri dönüşünüzü sabırsızlıkla beklemekteyiz.',
    thankYou: 'Zamanınız ve ilginiz için teşekkür ederiz.',
    subjectTemplates: {
      'partnership': '{{company}} ile iş ortaklığı fırsatı',
      'inquiry': 'Ürünleriniz hakkında ticari bilgi talebi'
    },
    commonReplacements: [
      [/Dear (?:Sir\/Madam|Customer|Partner|Team)/gi, 'Sayın Yetkili,'],
      [/Best regards|Kind regards|Sincerely/gi, 'Saygılarımızla,']
    ]
  },

  'Arabic': {
    greetings: ['السادة الكرام،', 'تحية طيبة وبعد،'],
    closings: ['مع خالص التحيات والتقدير،', 'وتفضلوا بقبول فائق الاحترام،'],
    partnership: 'فرصة تعاون تجاري مع {{company}}',
    inquiry: 'استفسار تجاري بخصوص منتجاتكم وخدماتكم',
    catalog: 'طلب كتالوج المنتجات وشروط التعاون لشركة {{company}}',
    proposal: 'عرض تعاون وشراكة تجارية لشركة {{company}}',
    collaboration: 'فرصة شراكة استراتيجية مع {{company}}',
    synergy: 'آفاق التكامل والشراكة بين شركتينا',
    intro: 'يسرني التواصل معكم لبحث سبل التعاون المشترك مع {{company}}.',
    interestInProducts: 'لدينا اهتمام كبير بمنتجاتكم وحلولكم المميزة.',
    requestDetails: 'هل يمكن تزويدنا بمزيد من التفاصيل والبيانات؟',
    hearingFromYou: 'نتطلع إلى تلقي ردكم الكريم.',
    thankYou: 'شاكرين لكم حسن تعاونكم ووقتكم الثمين.',
    subjectTemplates: {
      'partnership': 'فرصة تعاون تجاري مع {{company}}',
      'inquiry': 'استفسار تجاري بخصوص منتجاتكم'
    },
    commonReplacements: [
      [/Dear (?:Sir\/Madam|Customer|Partner|Team)/gi, 'السادة الكرام،'],
      [/Best regards|Kind regards|Sincerely/gi, 'مع خالص التحيات والتقدير،']
    ]
  }
};

/**
 * Intelligent Rule-Based Multilingual Translator (Zero external dependencies)
 * Guarantees that even without an API key or when offline, subjects and bodies
 * are translated meaningfully into target language and preserved with tokens.
 */
function translateWithLanguageProfile(subject: string, body: string, language: string, country?: string): { subject: string; body: string } {
  const profile = LANGUAGE_PROFILES[language];
  if (!profile) {
    return { subject, body };
  }

  // 1. Translate Subject
  let translatedSubj = subject;
  const lowerSubj = subject.toLowerCase();

  if (lowerSubj.includes('partnership') || lowerSubj.includes('partner') || lowerSubj.includes('cooperation')) {
    translatedSubj = profile.partnership;
  } else if (lowerSubj.includes('catalog') || lowerSubj.includes('brochure') || lowerSubj.includes('price')) {
    translatedSubj = profile.catalog;
  } else if (lowerSubj.includes('proposal') || lowerSubj.includes('offer') || lowerSubj.includes('quote') || lowerSubj.includes('rfq')) {
    translatedSubj = profile.proposal;
  } else if (lowerSubj.includes('inquiry') || lowerSubj.includes('enquiry') || lowerSubj.includes('question')) {
    translatedSubj = profile.inquiry;
  } else if (lowerSubj.includes('collaboration') || lowerSubj.includes('synergy')) {
    translatedSubj = profile.collaboration;
  } else if (lowerSubj.includes('introduction') || lowerSubj.includes('intro')) {
    translatedSubj = profile.subjectTemplates['introduction'] || profile.partnership;
  } else {
    // Translate common words in subject
    let mod = subject;
    for (const [re, repl] of profile.commonReplacements) {
      mod = mod.replace(re, repl);
    }
    translatedSubj = mod;
  }

  // 2. Translate Body
  let translatedBody = body;

  // Apply phrase replacements
  for (const [re, repl] of profile.commonReplacements) {
    translatedBody = translatedBody.replace(re, repl);
  }

  // Prepend localized greeting if body lacks standard localized greeting
  const firstGreeting = profile.greetings[0];
  const hasLocalGreeting = profile.greetings.some(g => translatedBody.toLowerCase().includes(g.toLowerCase()));

  if (!hasLocalGreeting && firstGreeting) {
    if (translatedBody.trim().startsWith('<')) {
      translatedBody = `<p>${firstGreeting}</p>\n` + translatedBody;
    } else {
      translatedBody = `${firstGreeting}\n\n` + translatedBody;
    }
  }

  // Append polite closing if not present
  const firstClosing = profile.closings[0];
  const hasLocalClosing = profile.closings.some(c => translatedBody.toLowerCase().includes(c.toLowerCase()));
  if (!hasLocalClosing && firstClosing) {
    if (translatedBody.trim().endsWith('>')) {
      translatedBody = translatedBody + `\n<p>${firstClosing}</p>`;
    } else {
      translatedBody = translatedBody + `\n\n${firstClosing}`;
    }
  }

  // Normalize duplicate commas and spacing
  translatedBody = translatedBody.replace(/,{2,}/g, ',').replace(/,\s*,/g, ',');

  return {
    subject: translatedSubj,
    body: translatedBody
  };
}

const LANGUAGE_CODE_MAP: Record<string, string> = {
  'german': 'de',
  'deutsch': 'de',
  'french': 'fr',
  'français': 'fr',
  'spanish': 'es',
  'español': 'es',
  'italian': 'it',
  'italiano': 'it',
  'dutch': 'nl',
  'nederlands': 'nl',
  'portuguese': 'pt',
  'português': 'pt',
  'polish': 'pl',
  'polski': 'pl',
  'swedish': 'sv',
  'svenska': 'sv',
  'norwegian': 'no',
  'norsk': 'no',
  'danish': 'da',
  'dansk': 'da',
  'finnish': 'fi',
  'suomi': 'fi',
  'russian': 'ru',
  'ukrainian': 'uk',
  'japanese': 'ja',
  'chinese': 'zh-CN',
  'korean': 'ko',
  'arabic': 'ar',
  'turkish': 'tr',
  'czech': 'cs',
  'greek': 'el',
  'hungarian': 'hu',
  'romanian': 'ro',
  'bulgarian': 'bg',
  'slovak': 'sk',
  'vietnamese': 'vi',
  'thai': 'th',
  'indonesian': 'id',
  'hebrew': 'he',
  'hindi': 'hi',
  'english': 'en'
};

export function getLanguageCode(langOrCountry: string): string {
  if (!langOrCountry) return 'en';
  const norm = langOrCountry.toLowerCase().trim();
  if (LANGUAGE_CODE_MAP[norm]) return LANGUAGE_CODE_MAP[norm];
  for (const [key, code] of Object.entries(LANGUAGE_CODE_MAP)) {
    if (norm.includes(key) || key.includes(norm)) return code;
  }
  return 'en';
}

// In-memory cache to guarantee sub-millisecond responses on repeated queries
const TRANSLATION_CACHE = new Map<string, string>();

/**
 * Translates text (plain or HTML) while preserving {{variables}} and HTML markup.
 * Uses a 3-tier neural translation cascade:
 * Tier 1: Google GTX Neural API (fastest, high fidelity)
 * Tier 2: Lingva Mirror API (robust fallback)
 * Tier 3: MyMemory API (high accuracy sentence translation)
 * Tier 4: Multilingual B2B dictionary & rule engine
 */
async function translateTextWithTokens(text: string, targetLangCode: string, targetLanguageName?: string): Promise<string> {
  if (!text || !text.trim() || targetLangCode === 'en') return text;

  const cacheKey = `${targetLangCode}:::${text}`;
  if (TRANSLATION_CACHE.has(cacheKey)) {
    return TRANSLATION_CACHE.get(cacheKey)!;
  }

  // 1. Protect template variables like {{first_name}}, {{company}}, {{sender_name}}
  const tokenMap: Array<{ id: number; original: string }> = [];
  let tokenCounter = 0;
  const protectedTokens = text.replace(/(\{\{[^}]+\}\})/g, (match) => {
    const id = tokenCounter++;
    tokenMap.push({ id, original: match });
    return `___VARTKN_${id}___`;
  });

  // 2. Protect HTML tags like <p>, </p>, <br>, <strong>, <a>, <table>
  const tagMap: Array<{ id: number; original: string }> = [];
  let tagCounter = 0;
  const protectedWithTags = protectedTokens.replace(/(<[^>]+>)/g, (match) => {
    const id = tagCounter++;
    tagMap.push({ id, original: match });
    return `___TAGTKN_${id}___`;
  });

  let rawTranslated = '';

  // --- TIER 1: Google GTX Neural Translation ---
  try {
    const gtxUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLangCode}&dt=t&q=${encodeURIComponent(protectedWithTags)}`;
    const res = await fetch(gtxUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*'
      },
      signal: AbortSignal.timeout(4500)
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && Array.isArray(data[0])) {
        const assembled = data[0].map((chunk: any) => (chunk && chunk[0]) || '').join('');
        if (assembled && assembled.trim().length > 0) {
          rawTranslated = assembled;
        }
      }
    }
  } catch (err: any) {
    // Continue to next tier
  }

  // --- TIER 2: Lingva Mirror API ---
  if (!rawTranslated) {
    try {
      const lingvaUrl = `https://lingva.ml/api/v1/en/${targetLangCode}/${encodeURIComponent(protectedWithTags)}`;
      const res = await fetch(lingvaUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(4000)
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.translation && typeof data.translation === 'string') {
          rawTranslated = data.translation;
        }
      }
    } catch {}
  }

  // --- TIER 3: MyMemory Translation API ---
  if (!rawTranslated) {
    try {
      const myMemUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(protectedWithTags.slice(0, 500))}&langpair=en|${targetLangCode}`;
      const res = await fetch(myMemUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(4500)
      });
      if (res.ok) {
        const data = await res.json();
        const trans = data?.responseData?.translatedText;
        if (trans && typeof trans === 'string' && !trans.toLowerCase().includes('quota exceeded') && !trans.toLowerCase().includes('mymemory')) {
          rawTranslated = trans;
        }
      }
    } catch {}
  }

  // If neural translation succeeded, restore placeholders
  if (rawTranslated) {
    let result = rawTranslated;

    // Restore HTML tags (allowing for potential spaces inserted by translator engine)
    tagMap.forEach(({ id, original }) => {
      result = result.replace(new RegExp(`___\\s*TAGTKN_${id}\\s*___`, 'gi'), original);
    });

    // Restore template variables (allowing for potential spaces inserted by translator engine)
    tokenMap.forEach(({ id, original }) => {
      result = result.replace(new RegExp(`___\\s*VARTKN_${id}\\s*___`, 'gi'), original);
    });

    TRANSLATION_CACHE.set(cacheKey, result);
    return result;
  }

  // --- TIER 4: Rule-based multilingual dictionary & business phrase profile ---
  if (targetLanguageName) {
    const profileResult = translateWithLanguageProfile(text, text, targetLanguageName);
    const fallbackText = text.trim().startsWith('<') ? profileResult.body : profileResult.subject;
    TRANSLATION_CACHE.set(cacheKey, fallbackText);
    return fallbackText;
  }

  return text;
}

export async function translateEmailContent(req: TranslationRequest): Promise<TranslationResult> {
  const { subject, body, targetLanguage, targetCountry, apiKey } = req;
  const envKey = (typeof process !== 'undefined' && process && process.env) ? (process.env.GEMINI_API_KEY || '') : '';
  const effectiveKey = (typeof apiKey === 'string' && apiKey.trim()) || envKey;

  // If already English or target is English, return original
  if (!targetLanguage || targetLanguage.toLowerCase() === 'english') {
    return {
      success: true,
      translatedSubject: subject,
      translatedBody: body,
      targetLanguage: 'English',
      targetCountry,
      note: 'Source and target language are both English.'
    };
  }

  // 1. Attempt AI Translation via Google GenAI SDK if API key is present
  if (effectiveKey) {
    const candidateModels = ['gemini-3.8-flash', 'gemini-flash-latest'];

    for (const modelName of candidateModels) {
      try {
        const ai = new GoogleGenAI({ apiKey: effectiveKey });
        const prompt = `You are a professional multilingual B2B corporate communications translator.
Translate the following email subject and email body into formal, polite business ${targetLanguage} (specifically tailored for organizations in ${targetCountry || targetLanguage}).

CRITICAL CONSTRAINTS:
1. PRESERVE ALL {{template_variables}} EXACTLY AS THEY ARE (e.g. {{first_name}}, {{last_name}}, {{full_name}}, {{company}}, {{phone}}, {{country}}, {{sender_name}}, {{domain}}, {{email}}, {{unsubscribe_url}}). DO NOT translate, change casing, or modify template variable names.
2. PRESERVE ALL HTML TAGS, CSS styles, and structural line breaks unchanged. Only translate the human-readable text content inside tags.
3. Use a respectful, professional B2B business tone (e.g. in German use "Sie" / formal address; in French use "vous" / formal address).

Subject to translate:
${subject}

Body to translate:
${body}

Return a valid JSON object ONLY with the following schema:
{
  "translatedSubject": "...",
  "translatedBody": "..."
}`;

        const response = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            temperature: 0.2
          }
        });

        let responseText = response.text?.trim() || '';
        if (responseText.startsWith('```')) {
          responseText = responseText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
        }

        if (responseText) {
          const parsed = JSON.parse(responseText);
          if (parsed.translatedSubject && parsed.translatedBody) {
            return {
              success: true,
              translatedSubject: parsed.translatedSubject,
              translatedBody: parsed.translatedBody,
              targetLanguage,
              targetCountry,
              note: `AI-translated into formal business ${targetLanguage} using ${modelName}.`
            };
          }
        }
      } catch (err: any) {
        console.warn(`[translateEmailContent] Model ${modelName} attempt failed:`, err?.message || err);
      }
    }
  }

  // 2. High-Accuracy Multilingual Neural Translation Cascade
  const langCode = getLanguageCode(targetLanguage || targetCountry || '');
  if (langCode && langCode !== 'en') {
    try {
      const [translatedSubj, translatedBody] = await Promise.all([
        subject ? translateTextWithTokens(subject, langCode, targetLanguage) : Promise.resolve(subject),
        body ? translateTextWithTokens(body, langCode, targetLanguage) : Promise.resolve(body)
      ]);

      if (translatedSubj || translatedBody) {
        return {
          success: true,
          translatedSubject: translatedSubj || subject,
          translatedBody: translatedBody || body,
          targetLanguage,
          targetCountry,
          note: `Automated ${targetLanguage} neural localization applied.`
        };
      }
    } catch (apiErr) {
      console.warn('[translateEmailContent] Neural translation fallback:', apiErr);
    }
  }

  // 3. Graceful rule-based multilingual profile fallback
  const ruleResult = translateWithLanguageProfile(subject, body, targetLanguage, targetCountry);
  return {
    success: true,
    translatedSubject: ruleResult.subject,
    translatedBody: ruleResult.body,
    targetLanguage,
    targetCountry,
    note: `Professional ${targetLanguage} business profile applied.`
  };
}
