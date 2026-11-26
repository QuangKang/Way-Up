import { BotDifficulty, MountainBiome } from '@climb/shared';
import { AppLanguage } from '../db/preferencesService';

export interface TranslationStrings {
  // Home & Top Bar
  appSubtitle: string;
  climberLabel: string;
  nicknamePlaceholder: string;
  nicknameEmptyError: string;
  nicknameSaveError: string;
  save: string;
  cancel: string;
  dismiss: string;
  close: string;
  statusInLobby: string;
  statusOnline: string;
  statusConnecting: string;
  statusOffline: string;
  onlineBtn: string;
  offlineBtn: string;
  createRoom: string;
  joinRoom: string;
  serverConnectingHint: string;
  serverOfflineHint: string;

  // Join Room Modal
  joinModalKicker: string;
  joinModalTitle: string;
  joinModalSub: string;
  joinCodeLengthError: string;
  joinServerOfflineError: string;
  joinConfirm: string;

  // Settings Modal (Cog ⚙️)
  settingsKicker: string;
  settingsTitle: string;
  languageLabel: string;
  langEnglish: string;
  langVietnamese: string;
  soundLabel: string;
  soundHint: string;
  hapticsLabel: string;
  hapticsHint: string;
  on: string;
  off: string;

  // How to Play Modal (Book 📖)
  guideKicker: string;
  guideTitle: string;
  guideTapLeft: string;
  guideTapRight: string;
  guideTapRule: string;
  guideRockTitle: string;
  guideRockDesc: string;
  guideIceTitle: string;
  guideIceDesc: string;
  guideBoulderTitle: string;
  guideBoulderDesc: string;
  guideBlizzardTitle: string;
  guideBlizzardDesc: string;
  guideGotIt: string;

  // Personal Records Modal (Trophy 🏆)
  recordsKicker: string;
  recordsTitle: string;
  recordsLoading: string;
  recordsEmptyTitle: string;
  recordsEmptySub: string;
  recordsTimePrefix: string;
  recordsSummitConquered: string;
  recordsPartialAscent: string;
  recordsPeakBadge: string;

  // Pre-Game Offline Setup & Match Settings
  setupKicker: string;
  setupTitle: string;
  chooseColorLabel: string;
  botDifficultyLabel: string;
  difficulty: Record<BotDifficulty, string>;
  matchRulesTitle: string;
  hostRulesHint: string;
  fallingBouldersLabel: string;
  icyLedgesLabel: string;
  timeLimitLabel: string;
  startClimbBtn: string;

  // Waiting Room
  onlineRoomCode: string;
  climbersCountSuffix: string;
  summitTargetSuffix: string;
  climbingCrewTitle: string;
  readyCountSuffix: string;
  youSuffix: string;
  hostBadge: string;
  readyBadge: string;
  prepBadge: string;
  openSlotPrefix: string;
  shareCodeLabel: string;
  readyUpBtn: string;
  readyActiveBtn: string;
  needTwoPlayersBtn: string;
  needTwoPlayersHint: string;
  waitingForReadyPrefix: string;
  startMatchPrefix: string;
  guestAllReadyHint: string;
  guestPleaseReadyHint: string;
  leaveRoomBtn: string;
  colorTakenHint: string;
  shortHandedKicker: string;
  shortHandedTitle: (count: number, max: number) => string;
  shortHandedSub: (code: string) => string;
  startAnywayBtn: string;
  countdownGetReady: string;
  countdownGo: string;
  offlineCountdownKicker: string;
  offlineRivalsLabel: string;

  // GameScreen HUD, Biomes, Toasts & Summit Waiting Overlay
  hudElevation: string;
  hudTimeLeft: string;
  hudVsAi: string;
  exitBtn: string;
  biomes: Record<MountainBiome, string>;
  leftBtn: string;
  leftLaneHint: string;
  rightBtn: string;
  rightLaneHint: string;
  rockfallWarning: string;
  summitWhiteout: string;
  toastMissedFall: string;
  toastMissed: string;
  toastIcySlip: string;
  toastBoulderHit: string;
  toastSummitConquered: string;
  summitWaitTitle: string;
  summitWaitTimeLabel: string;
  summitWaitProgress: (done: number, total: number) => string;
  summitWaitSub: string;
  skipWaitBtn: string;

  // Results Screen
  resultsOfflineKicker: string;
  resultsOnlineKicker: (code: string) => string;
  resultsTimeUpBanner: string;
  resultsSelfChampion: string;
  resultsOtherChampion: (name: string) => string;
  resultsComplete: string;
  resultsRecordSaved: string;
  youBadge: string;
  climbTimeCaption: string;
  maxAltitudeCaption: string;
  playAgainBtn: string;
  rematchBtn: string;
  backToHomeBtn: string;
}

export const TRANSLATIONS: Record<AppLanguage, TranslationStrings> = {
  en: {
    appSubtitle: 'ALPINE SUMMIT RACE',
    climberLabel: 'CLIMBER',
    nicknamePlaceholder: 'Climber nickname',
    nicknameEmptyError: 'Nickname cannot be empty',
    nicknameSaveError: 'Could not save nickname',
    save: 'Save',
    cancel: 'Cancel',
    dismiss: 'Dismiss',
    close: 'Close',
    statusInLobby: 'IN LOBBY',
    statusOnline: 'ONLINE',
    statusConnecting: 'CONNECTING',
    statusOffline: 'OFFLINE',
    onlineBtn: 'ONLINE',
    offlineBtn: 'OFFLINE',
    createRoom: 'Create Room',
    joinRoom: 'Join Room',
    serverConnectingHint: 'Connecting to multiplayer server...',
    serverOfflineHint: 'Server offline — Online rooms unavailable',

    joinModalKicker: 'ONLINE MULTIPLAYER',
    joinModalTitle: 'Join Room',
    joinModalSub: 'Enter the 4-character room code shared by the host.',
    joinCodeLengthError: 'Enter a 4-character room code.',
    joinServerOfflineError: 'Server is offline. Check your Wi-Fi connection.',
    joinConfirm: 'Join',

    settingsKicker: 'PREFERENCES',
    settingsTitle: 'Settings',
    languageLabel: 'Language',
    langEnglish: 'English',
    langVietnamese: 'Tiếng Việt',
    soundLabel: 'Sound Effects',
    soundHint: 'Audio cues for climbs, hazards & summit',
    hapticsLabel: 'Haptics',
    hapticsHint: 'Tactile vibration feedback on taps & hits',
    on: 'ON',
    off: 'OFF',

    guideKicker: 'CLIMBER FIELD GUIDE',
    guideTitle: 'How to Play',
    guideTapLeft: '◀ LEFT',
    guideTapRight: 'RIGHT ▶',
    guideTapRule:
      'Tap LEFT or RIGHT matching the lane of the next hold above you (+10m per step to the 500m Summit). Wrong lane slips down 20m!',
    guideRockTitle: 'Snowy Rock Hold',
    guideRockDesc:
      'Wide, sturdy granite foothold. Safe to rest on while timing your next climb.',
    guideIceTitle: 'Icy Slippery Hold',
    guideIceDesc:
      'Narrower frozen hold! Hop to the next hold within 0.75s before your grip bar runs out (-20m slide).',
    guideBoulderTitle: 'Falling Boulder',
    guideBoulderDesc:
      'When ⚠ ROCKFALL flashes at the top of a lane, a boulder tumbles straight down that lane (-30m & brief stun). Dodge to the opposite lane!',
    guideBlizzardTitle: 'Blizzard Gust',
    guideBlizzardDesc:
      'Near the Alpine Summit (350–500m), snowstorms sweep across the cliff to obscure vision. No knockback—keep your rhythm!',
    guideGotIt: "Got It — Let's Climb!",

    recordsKicker: 'SUMMIT LOGBOOK',
    recordsTitle: 'Personal Best Ascents',
    recordsLoading: 'Loading summit records...',
    recordsEmptyTitle: 'No ascents recorded yet',
    recordsEmptySub:
      'Complete an Online or Offline climb to log your fastest summit times!',
    recordsTimePrefix: 'Time',
    recordsSummitConquered: 'Summit Reached',
    recordsPartialAscent: 'Partial Ascent',
    recordsPeakBadge: '🏆 PEAK',

    setupKicker: 'SOLO EXPEDITION',
    setupTitle: 'Offline Climb Setup',
    chooseColorLabel: 'Climber Color',
    botDifficultyLabel: 'AI Bot Difficulty',
    difficulty: {
      EASY: 'Easy',
      MEDIUM: 'Medium',
      HARD: 'Hard'
    },
    matchRulesTitle: 'Match Settings',
    hostRulesHint: 'Configured by Host',
    fallingBouldersLabel: 'Falling Boulders',
    icyLedgesLabel: 'Icy Ledges',
    timeLimitLabel: 'Time Limit',
    startClimbBtn: '▲ Start Climb',

    onlineRoomCode: 'ONLINE ROOM CODE',
    climbersCountSuffix: 'CLIMBERS',
    summitTargetSuffix: 'SUMMIT',
    climbingCrewTitle: 'CLIMBING CREW',
    readyCountSuffix: 'Ready',
    youSuffix: '(You)',
    hostBadge: 'HOST',
    readyBadge: 'READY',
    prepBadge: 'WAIT',
    openSlotPrefix: 'Open Slot',
    shareCodeLabel: 'Share',
    readyUpBtn: 'Ready Up!',
    readyActiveBtn: '✓ Ready (Tap to Unready)',
    needTwoPlayersBtn: 'Need 2+ Climbers to Start',
    needTwoPlayersHint:
      'Share the room code with a friend — at least 2 climbers are needed for Online matches.',
    waitingForReadyPrefix: 'Waiting for Ready',
    startMatchPrefix: '▲ Start Match',
    guestAllReadyHint: 'All climbers ready! Waiting for Host to start...',
    guestPleaseReadyHint: 'Tap "Ready Up!" so the Host can start the climb.',
    leaveRoomBtn: 'Leave Room',
    colorTakenHint: 'Locked colors are already claimed by other climbers',
    shortHandedKicker: 'ROSTER CHECK',
    shortHandedTitle: (count, max) =>
      `Not enough players (${count}/${max}). Still want to start?`,
    shortHandedSub: (code) =>
      `Wait for more friends to join with code ${code}, or launch the race right now.`,
    startAnywayBtn: 'Start Anyway',
    countdownGetReady: 'GET READY TO CLIMB!',
    countdownGo: 'GO!',
    offlineCountdownKicker: 'OFFLINE RACE • VS 3 AI BOTS',
    offlineRivalsLabel: 'Rivals: FrostBot • CragHopper • PeakRunner',

    hudElevation: 'ELEVATION',
    hudTimeLeft: 'TIME LEFT',
    hudVsAi: 'VS AI',
    exitBtn: 'Exit',
    biomes: {
      FOOTHILLS: 'Rocky Foothills',
      CLIFFS: 'Steep Cliffs',
      SUMMIT: 'Alpine Summit'
    },
    leftBtn: '◀ LEFT',
    leftLaneHint: 'LEFT LANE',
    rightBtn: 'RIGHT ▶',
    rightLaneHint: 'RIGHT LANE',
    rockfallWarning: '⚠ ROCKFALL',
    summitWhiteout: '❄ SUMMIT WHITEOUT ▶▶',
    toastMissedFall: 'MISSED HOLD! -20m',
    toastMissed: 'MISSED HOLD!',
    toastIcySlip: '🧊 ICY SLIP! -20m',
    toastBoulderHit: '🪨 BOULDER HIT! -30m',
    toastSummitConquered: '🚩 SUMMIT REACHED!',
    summitWaitTitle: '🚩 Summit Reached!',
    summitWaitTimeLabel: 'Your Climb Time',
    summitWaitProgress: (done, total) =>
      `${done} / ${total} climbers finished`,
    summitWaitSub: 'Waiting at the peak for remaining climbers...',
    skipWaitBtn: 'Skip Wait ▶',

    resultsOfflineKicker: 'OFFLINE RACE • VS AI CLIMBERS',
    resultsOnlineKicker: (code) => `ONLINE STANDINGS • ROOM ${code}`,
    resultsTimeUpBanner: '⏱ TIME UP!',
    resultsSelfChampion: '🏆 SUMMIT CHAMPION!',
    resultsOtherChampion: (name) => `🏆 ${name} Reached the Peak!`,
    resultsComplete: 'Ascent Complete',
    resultsRecordSaved: '✓ Personal Record Saved',
    youBadge: 'YOU',
    climbTimeCaption: 'CLIMB TIME',
    maxAltitudeCaption: 'MAX HEIGHT',
    playAgainBtn: '▲ Play Again',
    rematchBtn: '▲ Play Again (Rematch)',
    backToHomeBtn: 'Back to Home'
  },

  vi: {
    appSubtitle: 'ĐUA LEO ĐỈNH NÚI TUYẾT',
    climberLabel: 'NHÀ LEO NÚI',
    nicknamePlaceholder: 'Nhập tên nhân vật',
    nicknameEmptyError: 'Tên không được để trống',
    nicknameSaveError: 'Không thể lưu tên',
    save: 'Lưu',
    cancel: 'Hủy',
    dismiss: 'Đóng',
    close: 'Đóng',
    statusInLobby: 'TRONG PHÒNG',
    statusOnline: 'TRỰC TUYẾN',
    statusConnecting: 'ĐANG KẾT NỐI',
    statusOffline: 'NGOẠI TUYẾN',
    onlineBtn: 'CHƠI MẠNG',
    offlineBtn: 'CHƠI ĐƠN',
    createRoom: 'Tạo phòng',
    joinRoom: 'Vào phòng',
    serverConnectingHint: 'Đang kết nối máy chủ...',
    serverOfflineHint: 'Máy chủ ngoại tuyến — không thể tạo phòng mạng',

    joinModalKicker: 'ĐẤU TRỰC TUYẾN',
    joinModalTitle: 'Vào phòng chơi',
    joinModalSub: 'Nhập mã phòng 4 ký tự từ chủ phòng.',
    joinCodeLengthError: 'Vui lòng nhập đủ 4 ký tự mã phòng.',
    joinServerOfflineError: 'Máy chủ đang ngoại tuyến. Kiểm tra kết nối Wi-Fi.',
    joinConfirm: 'Vào ngay',

    settingsKicker: 'TÙY CHỈNH',
    settingsTitle: 'Cài đặt',
    languageLabel: 'Ngôn ngữ',
    langEnglish: 'English',
    langVietnamese: 'Tiếng Việt',
    soundLabel: 'Âm thanh',
    soundHint: 'Hiệu ứng âm thanh khi leo, trượt băng & tới đỉnh',
    hapticsLabel: 'Rung phản hồi',
    hapticsHint: 'Rung nhẹ khi chạm mỏm đá hoặc va phải đá lăn',
    on: 'BẬT',
    off: 'TẮT',

    guideKicker: 'CẨM NANG LEO NÚI',
    guideTitle: 'Hướng dẫn chơi',
    guideTapLeft: '◀ TRÁI',
    guideTapRight: 'PHẢI ▶',
    guideTapRule:
      'Chạm TRÁI hoặc PHẢI khớp với làn của mỏm đá kế tiếp phía trên (+10m mỗi bước tới đỉnh 500m). Chạm sai làn sẽ trượt xuống 20m!',
    guideRockTitle: 'Mỏm đá phủ tuyết',
    guideRockDesc:
      'Mỏm đá rộng và chắc chắn. An toàn để dừng nhịp quan sát chướng ngại vật.',
    guideIceTitle: 'Mỏm băng trơn',
    guideIceDesc:
      'Mỏm băng hẹp và trơn! Phải nhảy sang mỏm tiếp theo trong 0.75 giây trước khi trượt xuống 20m.',
    guideBoulderTitle: 'Đá lăn',
    guideBoulderDesc:
      'Khi cảnh báo ⚠ ĐÁ LĂN nhấp nháy ở đầu làn, tảng đá sẽ lao dọc hết làn đó (-30m & choáng nhẹ). Hãy né sang làn đối diện!',
    guideBlizzardTitle: 'Bão tuyết đỉnh núi',
    guideBlizzardDesc:
      'Ở vùng Đỉnh Tuyết (350–500m), gió tuyết thổi ngang làm mờ tầm nhìn nhưng không đẩy ngã bạn. Hãy giữ vững nhịp!',
    guideGotIt: 'Đã hiểu — Xuất phát!',

    recordsKicker: 'SỔ VÀNG ĐỈNH NÚI',
    recordsTitle: 'Kỷ lục cá nhân',
    recordsLoading: 'Đang tải kỷ lục...',
    recordsEmptyTitle: 'Chưa có kỷ lục nào',
    recordsEmptySub:
      'Hoàn thành một chặng Chơi Mạng hoặc Chơi Đơn để lưu thành tích leo đỉnh nhanh nhất!',
    recordsTimePrefix: 'Thời gian',
    recordsSummitConquered: 'Đã chạm đỉnh',
    recordsPartialAscent: 'Chưa tới đỉnh',
    recordsPeakBadge: '🏆 ĐỈNH',

    setupKicker: 'CHinh PHỤC ĐƠN',
    setupTitle: 'Thiết lập chặng leo',
    chooseColorLabel: 'Màu trang phục',
    botDifficultyLabel: 'Độ khó máy (AI)',
    difficulty: {
      EASY: 'Dễ',
      MEDIUM: 'Vừa',
      HARD: 'Khó'
    },
    matchRulesTitle: 'Tùy chỉnh chặng đua',
    hostRulesHint: 'Chủ phòng thiết lập',
    fallingBouldersLabel: 'Đá lăn',
    icyLedgesLabel: 'Mỏm băng trơn',
    timeLimitLabel: 'Giới hạn giờ',
    startClimbBtn: '▲ Bắt đầu leo',

    onlineRoomCode: 'MÃ PHÒNG TRỰC TUYẾN',
    climbersCountSuffix: 'TAY LEO',
    summitTargetSuffix: 'ĐỈNH',
    climbingCrewTitle: 'ĐỘI LEO NÚI',
    readyCountSuffix: 'Sẵn sàng',
    youSuffix: '(Bạn)',
    hostBadge: 'CHỦ PHÒNG',
    readyBadge: 'SẴN SÀNG',
    prepBadge: 'CHỜ',
    openSlotPrefix: 'Chỗ trống',
    shareCodeLabel: 'Mã',
    readyUpBtn: 'Sẵn sàng!',
    readyActiveBtn: '✓ Đã sẵn sàng (Chạm để hủy)',
    needTwoPlayersBtn: 'Cần từ 2 người để bắt đầu',
    needTwoPlayersHint:
      'Chia sẻ mã phòng cho bạn bè — chế độ Chơi Mạng cần ít nhất 2 người.',
    waitingForReadyPrefix: 'Chờ sẵn sàng',
    startMatchPrefix: '▲ Bắt đầu đua',
    guestAllReadyHint: 'Cả đội đã sẵn sàng! Đang chờ Chủ phòng bắt đầu...',
    guestPleaseReadyHint: 'Hãy bấm "Sẵn sàng!" để Chủ phòng bắt đầu chặng đua.',
    leaveRoomBtn: 'Rời phòng',
    colorTakenHint: 'Màu bị khóa đã có người chơi khác chọn',
    shortHandedKicker: 'XÁC NHẬN ĐỘI HÌNH',
    shortHandedTitle: (count, max) =>
      `Chưa đủ người chơi (${count}/${max}). Bạn vẫn muốn bắt đầu?`,
    shortHandedSub: (code) =>
      `Bạn có thể đợi thêm bạn vào bằng mã ${code} hoặc xuất phát ngay bây giờ.`,
    startAnywayBtn: 'Vẫn bắt đầu',
    countdownGetReady: 'CHUẨN BỊ XUẤT PHÁT!',
    countdownGo: 'LEO!',
    offlineCountdownKicker: 'ĐUA ĐƠN • ĐẤU 3 MÁY AI',
    offlineRivalsLabel: 'Đối thủ: FrostBot • CragHopper • PeakRunner',

    hudElevation: 'ĐỘ CAO',
    hudTimeLeft: 'THỜI GIAN',
    hudVsAi: 'ĐẤU AI',
    exitBtn: 'Thoát',
    biomes: {
      FOOTHILLS: 'Chân núi đá',
      CLIFFS: 'Vách đá dựng',
      SUMMIT: 'Đỉnh tuyết trắng'
    },
    leftBtn: '◀ TRÁI',
    leftLaneHint: 'LÀN TRÁI',
    rightBtn: 'PHẢI ▶',
    rightLaneHint: 'LÀN PHẢI',
    rockfallWarning: '⚠ ĐÁ LĂN',
    summitWhiteout: '❄ BÃO TUYẾT ▶▶',
    toastMissedFall: 'HỤT TAY! -20m',
    toastMissed: 'HỤT TAY!',
    toastIcySlip: '🧊 TRƯỢT BĂNG! -20m',
    toastBoulderHit: '🪨 TRÚNG ĐÁ LĂN! -30m',
    toastSummitConquered: '🚩 ĐÃ CHẠM ĐỈNH!',
    summitWaitTitle: '🚩 Đã tới đỉnh!',
    summitWaitTimeLabel: 'Thời gian leo của bạn',
    summitWaitProgress: (done, total) => `${done} / ${total} người đã tới đỉnh`,
    summitWaitSub: 'Đang đợi các tay leo còn lại lên tới đỉnh...',
    skipWaitBtn: 'Bỏ qua chờ ▶',

    resultsOfflineKicker: 'KẾT QUẢ ĐUA ĐƠN • ĐẤU AI',
    resultsOnlineKicker: (code) => `BẢNG XẾP HẠNG • PHÒNG ${code}`,
    resultsTimeUpBanner: '⏱ HẾT GIỜ!',
    resultsSelfChampion: '🏆 NHÀ VÔ ĐỊCH ĐỈNH NÚI!',
    resultsOtherChampion: (name) => `🏆 ${name} về nhất!`,
    resultsComplete: 'Hoàn thành chặng leo',
    resultsRecordSaved: '✓ Đã lưu kỷ lục cá nhân',
    youBadge: 'BẠN',
    climbTimeCaption: 'THỜI GIAN LEO',
    maxAltitudeCaption: 'ĐỘ CAO ĐẠT',
    playAgainBtn: '▲ Chơi lại',
    rematchBtn: '▲ Đấu lại (Rematch)',
    backToHomeBtn: 'Về trang chủ'
  }
};
