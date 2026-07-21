import { useState, useEffect, useRef, useCallback } from 'react'
import { BingoEngine, BingoCell } from '@/logic/BingoEngine'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/use-auth'
import { useBilling, PRODUCT_DOUBLE_JS } from '@/hooks/use-billing'
import { CONFIG } from '@/config'
import { AdMob, BannerAdPosition, BannerAdSize, RewardAdPluginEvents } from '@capacitor-community/admob'
import {
    Trophy, Zap, Pause, Play, Flame, Target, Star,
    History, ShoppingBag, Award, Home, User as UserIcon,
    CreditCard, Gift, Mail, Lock, Eye, EyeOff, ArrowLeft, Info, LogOut, Clock,
    DollarSign, CheckCircle2, Loader2, Volume2, VolumeX, Sparkles
} from 'lucide-react'
import { toast } from 'sonner'

const COLUMN_THEMES = {
    0: { label: 'B', color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20', glow: 'shadow-cyan-500/50', active: 'bg-cyan-500' },
    1: { label: 'I', color: 'text-pink-500', bg: 'bg-pink-500/10', border: 'border-pink-500/20', glow: 'shadow-pink-500/50', active: 'bg-pink-500' },
    2: { label: 'N', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', glow: 'shadow-emerald-500/50', active: 'bg-emerald-500' },
    3: { label: 'G', color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', glow: 'shadow-yellow-500/50', active: 'bg-yellow-500' },
    4: { label: 'O', color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/20', glow: 'shadow-red-500/50', active: 'bg-red-500' },
}

const GAME_TRACKS = ['game1.mp3', 'game2.mp3', 'game3.mp3', 'game4.mp3', 'game5.mp3', 'game6.mp3', 'game7.mp3', 'game8.mp3', 'game9.mp3', 'game10.mp3'];

const REWARDS = [
    { id: 'v5', name: '$5 Visa Card', jp: 250000, type: 'Visa' },
    { id: 'a5', name: '$5 Amazon Gift', jp: 250000, type: 'Amazon' },
    { id: 'p5', name: '$5 PayPal Cash', jp: 250000, type: 'PayPal' },
    { id: 'v10', name: '$10 Visa Card', jp: 500000, type: 'Visa' },
    { id: 'a10', name: '$10 Amazon Gift', jp: 500000, type: 'Amazon' },
    { id: 'p10', name: '$10 PayPal Cash', jp: 500000, type: 'PayPal' },
    { id: 'v25', name: '$25 Visa Card', jp: 1250000, type: 'Visa' },
    { id: 'a25', name: '$25 Amazon Gift', jp: 1250000, type: 'Amazon' },
    { id: 'p25', name: '$25 PayPal Cash', jp: 1250000, type: 'PayPal' },
    { id: 'v50', name: '$50 Visa Card', jp: 2500000, type: 'Visa' },
    { id: 'a50', name: '$50 Amazon Gift', jp: 2500000, type: 'Amazon' },
    { id: 'p50', name: '$50 PayPal Cash', jp: 2500000, type: 'PayPal' },
];

export default function BingoXGame() {
    const { user, profile, loading, signIn, signUp, signOut, addJS, supabase } = useAuth()
    const { purchase } = useBilling(addJS)

    const [activeTab, setActiveTab] = useState<'play' | 'shop' | 'payout' | 'catalog' | 'how_to_play'>('play')
    const [isMuted, setIsMuted] = useState(false)
    const [isAdPlaying, setIsAdPlaying] = useState(false)
    const [showBingoCelebration, setShowBingoCelebration] = useState(false)
    const [board, setBoard] = useState<BingoCell[][]>(BingoEngine.generateBoard())
    const [calledNumbers, setCalledNumbers] = useState<number[]>([])
    const [currentCall, setCurrentCall] = useState<number | null>(null)
    const [sessionScore, setSessionScore] = useState(0)
    const [isAutoPlaying, setIsAutoPlaying] = useState(false)
    const [gameOver, setGameOver] = useState(false)
    const [winType, setWinType] = useState<string | null>(null)
    const [progress, setProgress] = useState(0)
    const [round, setRound] = useState(1)
    const [timeLeft, setTimeLeft] = useState(CONFIG.ROUND_TIME_LIMIT)
    const [isAdLoading, setIsAdLoading] = useState(false)
    const [completedPatterns, setCompletedPatterns] = useState<string[]>([])
    const [hasAwardedX, setHasAwardedX] = useState(false)
    const [hasAwardedFullHouse, setHasAwardedFullHouse] = useState(false)
    const [isDoubleScoring, setIsDoubleScoring] = useState(false)
    const [hasWildCard, setHasWildCard] = useState(false)
    const [roundCounter, setRoundCounter] = useState(0)
    const [leaderboard, setLeaderboard] = useState<any[]>([])

    const bgmRef = useRef<HTMLAudioElement | null>(null)
    const currentTrackRef = useRef<string>("")
    const callerRef = useRef<HTMLAudioElement | null>(null)
    const isMutedRef = useRef(false)
    const isAdPlayingRef = useRef(false)

    // Sync refs for audio callbacks
    useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);
    useEffect(() => { isAdPlayingRef.current = isAdPlaying; }, [isAdPlaying]);

    // BGM Initialization
    useEffect(() => {
        bgmRef.current = new Audio();
        bgmRef.current.loop = true;
        return () => bgmRef.current?.pause();
    }, []);

    // BGM Logic
    useEffect(() => {
        if (!bgmRef.current || !user) return;
        bgmRef.current.muted = isMuted;

        let targetSrc = "";
        if (activeTab !== 'play' && !isAutoPlaying) {
            targetSrc = "/audio/bgm/login.mp3";
        } else if (isAutoPlaying) {
            if (!currentTrackRef.current.includes("game")) {
                targetSrc = `/audio/bgm/${GAME_TRACKS[Math.floor(Math.random() * GAME_TRACKS.length)]}`;
            } else {
                targetSrc = currentTrackRef.current;
            }
        } else {
            targetSrc = "/audio/bgm/login.mp3";
        }

        if (targetSrc && currentTrackRef.current !== targetSrc) {
            bgmRef.current.src = targetSrc;
            currentTrackRef.current = targetSrc;
            bgmRef.current.load();
            bgmRef.current.play().catch(() => {});
        }
    }, [user, isAutoPlaying, activeTab, isMuted, round]);

    const playCall = useCallback((num: number) => {
        if (isAdPlayingRef.current || isMutedRef.current) return;

        if (callerRef.current) {
            callerRef.current.pause();
            callerRef.current.currentTime = 0;
        }

        let prefix = num <= 15 ? "B" : num <= 30 ? "I" : num <= 45 ? "N" : num <= 60 ? "G" : "O";
        const audio = new Audio(`/audio/calls/${prefix}-${num}.MP3`);
        audio.muted = isMutedRef.current;
        callerRef.current = audio;
        audio.play().catch(() => {});
    }, []);

    const processWins = useCallback((winResult: any) => {
        let extraScore = 0;
        let triggeredBingo = false;

        winResult.patterns.forEach((p: any) => {
            const pKey = p.join(',');
            setCompletedPatterns(prev => {
                if (!prev.includes(pKey)) {
                    extraScore += CONFIG.BINGO_BONUS;
                    triggeredBingo = true;
                    toast.success("BINGO!", { icon: '🔥', description: "+5,000 JS" });
                    return [...prev, pKey];
                }
                return prev;
            });
        });

        if (winResult.isXPattern && !hasAwardedX) {
            extraScore += CONFIG.X_PATTERN_BONUS;
            setHasAwardedX(true);
            triggeredBingo = true;
            toast.success("X-PATTERN BONUS!", { icon: '💎', description: "+15,000 JS" });
            new Audio('/audio/sfx/jackpot.mp3').play().catch(() => {});
        }

        if (winResult.isFullHouse && !hasAwardedFullHouse) {
            extraScore += 5000;
            setHasAwardedFullHouse(true);
            triggeredBingo = true;
            toast.success("FULL HOUSE!", { icon: '🏆', description: "+5,000 JS" });
            new Audio('/audio/sfx/jackpot.mp3').play().catch(() => {});
        }

        if (triggeredBingo) {
            new Audio('/audio/sfx/bingo.mp3').play().catch(() => {});
            setShowBingoCelebration(true);
            setTimeout(() => setShowBingoCelebration(false), 3000);
            setSessionScore(prev => prev + extraScore);
        }
    }, [hasAwardedX, hasAwardedFullHouse]);

    // ADMOB STABLE LISTENERS
    useEffect(() => {
        if (!user) return;

        const initAds = async () => {
            try {
                await AdMob.initialize();
                await AdMob.prepareInterstitialAd({ adId: CONFIG.ADMOB_INTERSTITIAL_ID, isTesting: CONFIG.IS_TESTING });
                await AdMob.prepareRewardVideoAd({ adId: CONFIG.ADMOB_REWARDED_ID, isTesting: CONFIG.IS_TESTING });
                await AdMob.showBanner({
                    adId: CONFIG.ADMOB_BANNER_ID,
                    position: BannerAdPosition.TOP_CENTER,
                    size: BannerAdSize.BANNER,
                    isTesting: CONFIG.IS_TESTING,
                    margin: 40
                });
            } catch (e) {}
        };

        const rListener = AdMob.addListener(RewardAdPluginEvents.Rewarded, () => {
            setIsAdPlaying(false);
            if (bgmRef.current) bgmRef.current.play().catch(() => {});

            const bonuses = ['WILD', 'AUTO', 'TIME', 'DOUBLE'];
            const chosen = bonuses[Math.floor(Math.random() * bonuses.length)];

            if (chosen === 'WILD') {
                setHasWildCard(true);
                toast.success("Lucky Daub: WILD CARD!", { icon: '✨', description: 'Mark any cell!' });
            } else if (chosen === 'AUTO') {
                setBoard(prev => {
                    const nextBoard = [...prev];
                    const targets: {r:number, c:number}[] = [];
                    nextBoard.forEach((row, r) => row.forEach((cell, c) => { if(!cell.marked) targets.push({r,c}) }));
                    targets.sort(() => Math.random() - 0.5).slice(0, 2).forEach(t => nextBoard[t.r][t.c].marked = true);
                    const winResult = BingoEngine.checkWins(nextBoard);
                    processWins(winResult);
                    return nextBoard;
                });
                toast.success("Lucky Daub: AUTO DAUB 2!", { icon: '🤖' });
            } else if (chosen === 'TIME') {
                setTimeLeft(prev => prev + 10);
                toast.success("Lucky Daub: +10 SECONDS!", { icon: '⏰' });
            } else {
                setIsDoubleScoring(true);
                setTimeout(() => setIsDoubleScoring(false), 15000);
                toast.success("Lucky Daub: 2X POINTS (15s)!", { icon: '🔥' });
            }
            setIsAdLoading(false);
        });

        const dListener = AdMob.addListener(RewardAdPluginEvents.Dismissed, () => {
            setIsAdPlaying(false);
            setIsAdLoading(false);
            if (bgmRef.current) bgmRef.current.play().catch(() => {});
        });

        const fListener = AdMob.addListener(RewardAdPluginEvents.FailedToLoad, () => {
            setIsAdPlaying(false);
            setIsAdLoading(false);
        });

        initAds();
        return () => {
            rListener.remove();
            dListener.remove();
            fListener.remove();
        }
    }, [user, processWins]);

    // GAME LOOP
    const pickNumber = useCallback(() => {
        if (isAdPlayingRef.current || gameOver) return;
        setCalledNumbers(prev => {
            const remaining = Array.from({length: 75}, (_, i) => i + 1).filter(n => !prev.includes(n));
            if (remaining.length === 0) {
                setGameOver(true);
                setWinType("BOARD FULL");
                setIsAutoPlaying(false);
                if (sessionScore > 0) addJS(sessionScore);
                return prev;
            }
            const next = remaining[Math.floor(Math.random() * remaining.length)];
            setCurrentCall(next);
            setProgress(0);
            playCall(next);
            return [next, ...prev];
        });
    }, [gameOver, sessionScore, addJS, playCall]);

    useEffect(() => {
        let interval: any;
        if (isAutoPlaying && !gameOver && activeTab === 'play') {
            interval = setInterval(pickNumber, 3500);
        }
        return () => clearInterval(interval);
    }, [isAutoPlaying, gameOver, activeTab, pickNumber]);

    useEffect(() => {
        let timer: any;
        if (isAutoPlaying && !gameOver && activeTab === 'play' && timeLeft > 0) {
            timer = setInterval(() => {
                setTimeLeft(prev => {
                    if (prev <= 1) {
                        setGameOver(true);
                        setWinType(sessionScore > 0 ? "TIME'S UP!" : "ROUND OVER");
                        setIsAutoPlaying(false);
                        if (sessionScore > 0) addJS(sessionScore);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => clearInterval(timer);
    }, [isAutoPlaying, gameOver, activeTab, timeLeft, sessionScore, addJS]);

    useEffect(() => {
        if (isAutoPlaying && activeTab === 'play') {
            const timer = setInterval(() => setProgress(prev => (prev >= 100 ? 0 : prev + 2.86)), 100);
            return () => clearInterval(timer);
        }
    }, [isAutoPlaying, activeTab]);

    useEffect(() => {
        if (activeTab === 'payout' && supabase) {
            const getLeaderboard = async () => {
                const { data } = await supabase.from('profiles').select('username, jackpot_score').order('jackpot_score', { ascending: false }).limit(5);
                if (data) setLeaderboard(data);
            };
            getLeaderboard();
        }
    }, [activeTab, supabase]);

    const markCell = (r: number, c: number) => {
        if (gameOver || isAdPlaying) return;
        const cell = board[r][c];
        if (cell.number === "FREE" || calledNumbers.includes(cell.number as number) || hasWildCard) {
            if (cell.marked) return;
            const newBoard = [...board];
            newBoard[r][c].marked = true;
            setBoard(newBoard);

            const speedBonus = Math.floor((100 - progress) * 5);
            let earned = CONFIG.POINTS_PER_DAUB + speedBonus;
            if (isDoubleScoring) earned *= 2;
            setSessionScore(prev => prev + earned);

            if (hasWildCard && cell.number !== "FREE" && !calledNumbers.includes(cell.number as number)) setHasWildCard(false);

            const winResult = BingoEngine.checkWins(newBoard);
            processWins(winResult);
        }
    }

    const handleRewardBoost = async () => {
        if (!isAutoPlaying || gameOver || isAdLoading) return;
        setIsAdLoading(true);
        setIsAdPlaying(true);
        if (bgmRef.current) bgmRef.current.pause();
        if (callerRef.current) callerRef.current.pause();
        try {
            await AdMob.showRewardVideoAd();
        } catch (e) {
            toast.error("Ad not ready yet.");
            setIsAdLoading(false);
            setIsAdPlaying(false);
            if (bgmRef.current) bgmRef.current.play().catch(() => {});
        }
    }

    const nextRound = async () => {
        const nextRC = roundCounter + 1;
        setRoundCounter(nextRC);
        if (nextRC % 2 === 0) {
            try { await AdMob.showInterstitialAd(); } catch (e) {}
        }
        setBoard(BingoEngine.generateBoard());
        setCalledNumbers([]);
        setCurrentCall(null);
        setGameOver(false);
        setWinType(null);
        setRound(r => r + 1);
        setIsAutoPlaying(false);
        setTimeLeft(CONFIG.ROUND_TIME_LIMIT);
        setSessionScore(0);
        setCompletedPatterns([]);
        setHasAwardedX(false);
        setHasAwardedFullHouse(false);
        setIsDoubleScoring(false);
        setHasWildCard(false);
    }

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [isLogin, setIsLogin] = useState(true);
    const [showPass, setShowPass] = useState(false);
    const [agreed, setAgreed] = useState(false);

    const handlePayoutRequest = async (reward: any) => {
        if ((profile?.jackpot_score || 0) < reward.jp) return;

        const confirmPay = confirm(`Redeem ${reward.jp.toLocaleString()} JS for a ${reward.name}?`);
        if (!confirmPay) return;

        try {
            const { error: reqError } = await supabase.from('payout_requests').insert({
                user_id: user?.id,
                reward_name: reward.name,
                points_cost: reward.jp,
                status: 'pending'
            });
            if (reqError) throw reqError;
            await addJS(-reward.jp);
            toast.success("Payout Requested! Check your email.");
        } catch (e: any) {
            alert("Error: " + e.message);
        }
    }

    if (loading) return <div className="h-screen w-full bg-[#050510] flex items-center justify-center text-white"><Loader2 className="animate-spin text-primary" /></div>;

    if (!user) {
        return (
            <div className="h-screen w-full bg-[#050510] flex flex-col items-center justify-center p-8 text-white relative">
                <img src="logo.png" className="w-48 h-48 mb-6 drop-shadow-glow" alt="Logo" />
                <h1 className="text-5xl font-black italic mb-2 text-primary tracking-tighter uppercase text-center leading-none">Bingo X</h1>
                <p className="text-white/40 uppercase tracking-[0.4em] text-[9px] mb-12 font-bold text-center">Skill Edition</p>
                <form onSubmit={(e) => { e.preventDefault(); if (!isLogin && !agreed) return toast.error("Agree to terms."); isLogin ? signIn(email, password) : signUp(email, password, username); }} className="w-full max-w-sm space-y-3">
                    {!isLogin && (
                        <div className="bg-white/5 border border-white/10 rounded-2xl flex items-center px-4 py-4">
                            <UserIcon className="h-5 w-5 text-white/20 mr-3" />
                            <input type="text" placeholder="Username" className="bg-transparent outline-none w-full font-bold text-white" value={username} onChange={e => setUsername(e.target.value)} required />
                        </div>
                    )}
                    <div className="bg-white/5 border border-white/10 rounded-2xl flex items-center px-4 py-4">
                        <Mail className="h-5 w-5 text-white/20 mr-3" />
                        <input type="email" placeholder="Email" className="bg-transparent outline-none w-full font-bold text-white" value={email} onChange={e => setEmail(e.target.value)} required />
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-2xl flex items-center px-4 py-4">
                        <Lock className="h-5 w-5 text-white/20 mr-3" />
                        <input type={showPass ? "text" : "password"} placeholder="Password" name="password" className="bg-transparent outline-none w-full font-bold text-white" value={password} onChange={e => setPassword(e.target.value)} required />
                        <button type="button" onClick={() => setShowPass(!showPass)}>{showPass ? <EyeOff className="h-4 w-4 opacity-30" /> : <Eye className="h-4 w-4 opacity-30" />}</button>
                    </div>
                    {!isLogin && (
                        <div className="flex items-center gap-3 px-2 py-2">
                            <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} className="accent-primary" />
                            <span className="text-[10px] text-white/40 font-bold uppercase">18+ / Agree to Terms</span>
                        </div>
                    )}
                    <button type="submit" className="w-full bg-primary py-5 rounded-3xl font-black uppercase tracking-widest shadow-glow mt-4 active:scale-95 transition-transform">{isLogin ? 'Login' : 'Create Account'}</button>
                    <button type="button" onClick={() => setIsLogin(!isLogin)} className="w-full text-center text-xs opacity-40 font-bold uppercase mt-4 underline">{isLogin ? "New? Sign up" : "Login"}</button>
                </form>
            </div>
        )
    }

    return (
        <div className="h-screen w-full bg-[#02020a] text-white font-sans flex flex-col items-center overflow-hidden relative">

            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.04] z-0">
                <span className="text-[90vh] font-black italic animate-float-slow select-none">X</span>
            </div>

            <div className="flex-1 w-full max-w-md flex flex-col items-center z-10 overflow-y-auto px-4 pt-10 pb-32 no-scrollbar">

                {activeTab === 'play' && (
                    <>
                        <div className="w-full flex justify-between items-start mb-6 px-2">
                            <div className="flex flex-col gap-2">
                                <button onClick={() => setIsMuted(!isMuted)} className="p-3 bg-white/5 rounded-xl border border-white/10 active:scale-90">
                                    {isMuted ? <VolumeX className="h-5 w-5 text-white/40" /> : <Volume2 className="h-5 w-5 text-primary" />}
                                </button>
                                <button onClick={() => signOut()} className="p-3 bg-white/5 rounded-xl border border-white/10 active:scale-90 text-red-500">
                                    <LogOut className="h-5 w-5" />
                                </button>
                            </div>

                            <div className="flex flex-col items-end gap-3">
                                <div className="bg-white/5 border border-white/10 px-4 py-2 rounded-2xl flex items-center gap-2 backdrop-blur-xl">
                                    <Flame className={cn("h-4 w-4", isDoubleScoring ? "text-orange-500 animate-pulse" : "text-primary")} />
                                    <span className="text-xl font-black italic">{sessionScore.toLocaleString()}</span>
                                </div>
                                <div className="bg-white/5 border border-white/10 px-4 py-2 rounded-2xl flex items-center gap-2 backdrop-blur-xl">
                                    <Zap className="h-4 w-4 text-yellow-400 fill-yellow-400 shadow-glow" />
                                    <span className="text-[10px] font-black italic">{(profile?.jackpot_score || 0).toLocaleString()} JS</span>
                                </div>
                                <div className={cn(
                                    "flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black italic border",
                                    timeLeft < 20 ? "text-red-500 border-red-500 animate-pulse bg-red-500/10" : "text-white/60 border-white/10 bg-white/5"
                                )}>
                                    <Clock className="h-3 w-3" />
                                    {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                                </div>
                            </div>
                        </div>

                        <div className="w-full mb-4">
                            <div className="bg-gradient-to-b from-white/10 to-transparent border border-white/10 rounded-[35px] p-6 flex items-center justify-between shadow-2xl backdrop-blur-md relative">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black opacity-30 uppercase tracking-[0.2em] mb-1 flex items-center gap-2">
                                        <Target className="h-3 w-3" /> Next Ball
                                    </span>
                                    <div className="flex items-baseline gap-2">
                                        <span className={cn("text-6xl font-black italic leading-none", currentCall ? COLUMN_THEMES[Math.floor((currentCall-1)/15) as 0].color : "text-white/20")}>
                                            {currentCall ? (currentCall <= 15 ? 'B' : currentCall <= 30 ? 'I' : currentCall <= 45 ? 'N' : currentCall <= 60 ? 'G' : 'O') : '-'}
                                        </span>
                                        <span className="text-6xl font-black italic leading-none">{currentCall || "00"}</span>
                                    </div>
                                </div>

                                <div className="relative w-20 h-20">
                                    <svg className="w-full h-full -rotate-90">
                                        <circle cx="40" cy="40" r="35" fill="transparent" stroke="currentColor" strokeWidth="4" className="text-white/5" />
                                        <circle cx="40" cy="40" r="35" fill="transparent" stroke="currentColor" strokeWidth="4" strokeDasharray="220" strokeDashoffset={220 - (220 * progress) / 100} className="text-primary transition-all duration-100 ease-linear shadow-glow" />
                                    </svg>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        {isAutoPlaying ? <Flame className="h-6 w-6 text-primary animate-pulse" /> : <Play className="h-6 w-6 text-white/20" />}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-2 mb-6 opacity-60">
                            <History className="h-4 w-4 mr-2" />
                            {calledNumbers.slice(1, 6).map((n, i) => (
                                <div key={i} className="text-[10px] font-black border border-white/10 px-2 py-1 rounded-md bg-white/5">{n}</div>
                            ))}
                        </div>

                        <div className={cn("relative p-2 rounded-[45px] bg-black border-4 shadow-2xl mb-8 transition-colors duration-500", hasWildCard ? "border-purple-500/50 shadow-purple-500/20" : "border-white/5")}>
                            {hasWildCard && <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-purple-500 text-white px-4 py-1 rounded-full text-[10px] font-black uppercase italic animate-bounce shadow-glow">Wild Card Active!</div>}
                            <div className="grid grid-cols-5 gap-1.5">
                                {['B','I','N','G','O'].map((l, i) => (
                                    <div key={l} className={cn("w-14 h-12 flex flex-col items-center justify-center font-black text-2xl italic rounded-t-3xl", (COLUMN_THEMES as any)[i].bg, (COLUMN_THEMES as any)[i].color)}>
                                        {l}
                                        <div className={cn("h-1 w-6 rounded-full mt-1", (COLUMN_THEMES as any)[i].active)} />
                                    </div>
                                ))}
                                {board.map((row, r) => row.map((cell, c) => (
                                    <button
                                        key={`${r}-${c}`}
                                        onClick={() => markCell(r, c)}
                                        className={cn(
                                            "w-14 h-14 rounded-[22px] font-black text-xl transition-all active:scale-75 flex items-center justify-center relative",
                                            cell.marked
                                                ? (COLUMN_THEMES as any)[c].active + " shadow-[0_0_25px_rgba(255,255,255,0.3)] border-2 border-white/40 scale-95"
                                                : "bg-[#11111a] border-2 border-white/5 text-white/80"
                                        )}
                                    >
                                        {cell.number === "FREE" ? <Star className="h-6 w-6 fill-white" /> : cell.number}
                                        {!cell.marked && calledNumbers.includes(cell.number as number) && (
                                            <div className="absolute inset-0 bg-primary/20 rounded-[22px] animate-pulse border-2 border-primary/50" />
                                        )}
                                    </button>
                                )))}
                            </div>
                        </div>

                        <div className="flex gap-4 w-full px-4 mb-4">
                            <button
                                onClick={handleRewardBoost}
                                disabled={isAdLoading || !isAutoPlaying}
                                className="flex-1 py-4 bg-purple-600/20 border-2 border-purple-500/40 rounded-3xl flex items-center justify-center gap-2 font-black italic uppercase text-xs active:scale-95 transition-all disabled:opacity-50"
                            >
                                {isAdLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 text-purple-400" />}
                                Lucky Daub
                            </button>
                            <button
                                onClick={() => setIsAutoPlaying(!isAutoPlaying)}
                                className={cn(
                                    "flex-[2] py-4 rounded-[30px] font-black uppercase tracking-[0.2em] transition-all active:scale-95 flex items-center justify-center gap-3 shadow-glow",
                                    isAutoPlaying ? "bg-white/5 border-2 border-white/10 text-white" : "bg-primary text-black"
                                )}
                            >
                                {isAutoPlaying ? <Pause className="fill-current h-5 w-5" /> : <Play className="fill-current h-5 w-5" />}
                                {isAutoPlaying ? "Pause" : "Call Numbers"}
                            </button>
                        </div>
                    </>
                )}

                {activeTab === 'shop' && (
                    <div className="w-full py-8 animate-in slide-in-from-right duration-300">
                        <h2 className="text-5xl font-black italic uppercase tracking-tighter mb-8 text-cyan-400 text-center">Store</h2>
                        <div className="space-y-4">
                            <div className="bg-white/5 border border-white/10 p-6 rounded-[40px] flex justify-between items-center shadow-xl">
                                <div className="flex flex-col">
                                    <span className="font-black text-xl italic uppercase leading-none mb-1">Double JS</span>
                                    <span className="text-[10px] opacity-40 font-bold uppercase tracking-widest">Permanent 2x Points</span>
                                </div>
                                <button onClick={() => purchase(PRODUCT_DOUBLE_JS)} className="bg-primary text-black font-black px-6 py-3 rounded-2xl shadow-glow active:scale-95 transition-transform">$4.99</button>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'catalog' && (
                    <div className="w-full py-8 animate-in slide-in-from-right duration-300 px-2">
                        <button onClick={() => setActiveTab('payout')} className="flex items-center gap-2 text-white/30 uppercase font-black text-[10px] mb-8 active:scale-90"><ArrowLeft className="h-4 w-4" /> Back</button>
                        <h2 className="text-5xl font-black italic uppercase tracking-tighter mb-8 text-emerald-400 text-center">Prizes</h2>
                        <div className="grid grid-cols-1 gap-3">
                            {REWARDS.map(r => (
                                <div
                                    key={r.id}
                                    onClick={() => handlePayoutRequest(r)}
                                    className={cn(
                                        "bg-white/5 border p-6 rounded-[35px] flex justify-between items-center transition-all active:scale-95 cursor-pointer",
                                        (profile?.jackpot_score || 0) >= r.jp ? "border-emerald-500/50" : "border-white/10 opacity-40"
                                    )}
                                >
                                     <div className="flex flex-col text-left">
                                        <span className="font-black italic uppercase text-lg leading-none">{r.name}</span>
                                        <span className="text-[10px] opacity-40 font-bold mt-1 uppercase tracking-widest">{r.jp.toLocaleString()} JS Required</span>
                                     </div>
                                     { (profile?.jackpot_score || 0) >= r.jp ? <CheckCircle2 className="h-6 w-6 text-emerald-400" /> : <CreditCard className="h-8 w-8 text-white/10" /> }
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'how_to_play' && (
                    <div className="w-full py-8 animate-in slide-in-from-right duration-300 text-left">
                        <button onClick={() => setActiveTab('payout')} className="flex items-center gap-2 text-white/30 uppercase font-black text-[10px] mb-8 active:scale-90"><ArrowLeft className="h-4 w-4" /> Back</button>
                        <h2 className="text-5xl font-black italic uppercase tracking-tighter mb-8 text-emerald-400 text-center">Rules</h2>
                        <div className="bg-white/5 border border-white/10 p-8 rounded-[40px] space-y-6">
                            <section>
                                <h3 className="text-primary font-black uppercase text-xs mb-2 italic tracking-widest">Winning Patterns</h3>
                                <ul className="text-sm text-white/60 space-y-2 font-bold uppercase">
                                    <li>• 5 in a row (+5,000 JS)</li>
                                    <li>• 4 Corners (+5,000 JS)</li>
                                    <li>• X-Pattern (+15,000 JS Bonus!)</li>
                                    <li>• Full House (+5,000 JS Bonus!)</li>
                                </ul>
                            </section>
                            <section>
                                <h3 className="text-primary font-black uppercase text-xs mb-2 italic tracking-widest">Lucky Daub Bonuses</h3>
                                <ul className="text-xs text-white/60 space-y-1 font-bold uppercase">
                                    <li>• WILD CARD: Pick any cell to mark!</li>
                                    <li>• AUTO DAUB 2: Marks two numbers for you.</li>
                                    <li>• +10 SECONDS: More time on the clock.</li>
                                    <li>• 2X POINTS: Double scores for 15s!</li>
                                </ul>
                            </section>
                        </div>
                    </div>
                )}

                {activeTab === 'payout' && (
                    <div className="w-full py-8 animate-in slide-in-from-right duration-300 px-2">
                        <h2 className="text-5xl font-black italic uppercase tracking-tighter mb-8 text-emerald-400 text-center">Wins</h2>
                        <div className="bg-gradient-to-br from-emerald-900 to-green-950 p-8 rounded-[50px] border-2 border-emerald-500/20 shadow-2xl relative overflow-hidden group mb-6">
                             <div className="flex justify-between items-start">
                                <Gift className="h-12 w-12 text-emerald-400 mb-4" />
                                <div className="bg-black/40 px-4 py-2 rounded-2xl border border-white/10 text-right backdrop-blur-md">
                                    <div className="text-[8px] uppercase font-black opacity-60 text-emerald-400">Account Total</div>
                                    <div className="text-xl font-black italic text-white">{(profile?.jackpot_score || 0).toLocaleString()} JS</div>
                                </div>
                             </div>
                             <h3 className="text-2xl font-black uppercase italic leading-none mb-2">Jackpot Rewards</h3>
                             <p className="text-[10px] text-white/60 font-bold uppercase tracking-widest mb-6">Redeem points for real world money</p>
                             <button onClick={() => setActiveTab('catalog')} className="w-full bg-white text-emerald-900 font-black py-4 rounded-3xl uppercase tracking-widest text-xs active:scale-95 transition-transform relative z-[100]">Browse Catalog</button>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mt-6">
                            <button onClick={() => setActiveTab('how_to_play')} className="bg-white/5 border border-white/10 py-4 rounded-2xl font-black uppercase text-[10px] active:scale-95 text-center">Rules</button>
                            <button onClick={() => window.open(CONFIG.PRIVACY_URL, '_blank')} className="bg-white/5 border border-white/10 py-4 rounded-2xl font-black uppercase text-[10px] active:scale-95 text-center">Privacy</button>
                        </div>

                        <div className="mt-12 bg-white/5 rounded-[40px] p-6 border-2 border-white/10">
                            <Trophy className="h-8 w-8 text-yellow-400 mx-auto mb-4" />
                            <h3 className="font-black uppercase italic mb-4 text-xs opacity-50 text-center text-primary tracking-widest">Global Leaderboard</h3>
                            <div className="space-y-3">
                                {leaderboard.length > 0 ? (
                                    leaderboard.map((u, i) => (
                                        <div key={i} className="flex justify-between items-center text-[10px] font-black border-b border-white/5 pb-2">
                                            <span className="flex items-center gap-2"><span className="opacity-30">{i+1}.</span> {u.username || 'Gamer'}</span>
                                            <span className="text-primary italic">{(u.jackpot_score || 0).toLocaleString()} JS</span>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-4 opacity-30 text-[10px] font-black uppercase italic tracking-widest">No scores yet today</div>
                                )}
                            </div>
                        </div>

                        <div className="mt-8 flex flex-col items-center gap-4 text-center">
                            <div className="text-[10px] font-bold opacity-30 uppercase tracking-[0.2em]">Active Player</div>
                            <span className="text-xl font-black italic border-b border-primary pb-1 text-primary">{profile?.username || 'Gamer'}</span>
                        </div>
                    </div>
                )}
            </div>

            <nav className="fixed bottom-0 left-0 right-0 h-24 bg-[#050510]/95 backdrop-blur-3xl border-t border-white/10 flex justify-around items-center px-4 pb-4 z-50">
                <NavButton icon={ShoppingBag} label="Store" active={activeTab === 'shop'} onClick={() => setActiveTab('shop')} />
                <NavButton icon={Home} label="Play" active={activeTab === 'play'} onClick={() => setActiveTab('play')} />
                <NavButton icon={Award} label="Wins" active={activeTab === 'payout'} onClick={() => setActiveTab('payout')} />
            </nav>

            {showBingoCelebration && (
                <div className="fixed inset-0 z-[3000] pointer-events-none flex items-center justify-center overflow-hidden">
                    <div className="animate-bounce text-6xl font-black italic text-primary drop-shadow-[0_0_30px_rgba(34,211,238,0.8)] uppercase tracking-tighter">BINGO!</div>
                    {[...Array(20)].map((_, i) => (
                        <div key={i} className="absolute animate-fall" style={{
                            left: `${Math.random() * 100}%`,
                            top: `-10%`,
                            animationDelay: `${Math.random() * 2}s`,
                            backgroundColor: i % 2 === 0 ? '#22d3ee' : '#ec4899',
                            width: '8px', height: '8px', borderRadius: '50%'
                        }} />
                    ))}
                </div>
            )}

            {gameOver && (
                <div className="fixed inset-0 z-[2000] bg-black/95 flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-700 backdrop-blur-md">
                    <Trophy className={cn("h-32 w-32 mb-8 drop-shadow-glow scale-125", sessionScore === 0 ? "text-red-500" : "text-yellow-400")} />
                    <h2 className={cn("text-7xl font-black italic mb-2 uppercase tracking-tighter leading-none", sessionScore === 0 ? "text-red-500" : "text-white")}>{winType}</h2>
                    <div className="bg-white/5 border-2 border-white/10 p-10 rounded-[50px] mb-12 relative overflow-hidden">
                        <div className={cn("absolute top-0 left-0 w-full h-1 shadow-glow", sessionScore === 0 ? "bg-red-500" : "bg-primary")} />
                        <span className="block text-[10px] opacity-40 font-black mb-2 tracking-widest uppercase">Session Points</span>
                        <span className="text-6xl font-black italic text-white drop-shadow-glow">{sessionScore.toLocaleString()}</span>
                    </div>
                    <button onClick={nextRound} className="w-full max-w-xs py-8 bg-white text-black rounded-full font-black text-2xl italic active:scale-95 transition-transform uppercase tracking-widest shadow-2xl">Continue</button>
                </div>
            )}
        </div>
    )
}

function NavButton({ icon: Icon, label, active, onClick }: { icon: any, label: string, active: boolean, onClick: () => void }) {
    return (
      <button onClick={onClick} className={cn("flex flex-col items-center justify-center gap-1 w-20 py-2 transition-all active:scale-90", active ? "text-primary scale-110" : "text-white/30")}>
        <Icon className={cn("h-6 w-6", active && "fill-current")} />
        <span className={cn("text-[8px] font-black uppercase tracking-widest", active ? "opacity-100" : "opacity-40")}>{label}</span>
      </button>
    );
}
