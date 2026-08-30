import { useState, useEffect, useRef, useCallback } from 'react'
import { BingoEngine, BingoCell } from '@/logic/BingoEngine'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/use-auth'
import { useBilling, PRODUCT_DOUBLE_JS } from '@/hooks/use-billing'
import { initAds, showRewardedAd, showInterstitial, showBannerAd, hideBannerAd } from '@/lib/ads'
import { CONFIG } from '@/config'
import {
    Trophy, Zap, Pause, Play, Flame, Target, Star,
    History, ShoppingBag, Award, Home, User as UserIcon,
    CreditCard, Gift, Mail, Lock, Eye, EyeOff, ArrowLeft, Info, LogOut, Clock,
    CheckCircle2, Loader2, Volume2, VolumeX, Sparkles, Coins, Wallet
} from 'lucide-react'
import { toast } from 'sonner'
import { Capacitor } from '@capacitor/core'

const COLUMN_THEMES = {
    0: { label: 'B', color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20', glow: 'shadow-cyan-500/50', active: 'bg-cyan-500' },
    1: { label: 'I', color: 'text-pink-500', bg: 'bg-pink-500/10', border: 'border-pink-500/20', glow: 'shadow-pink-500/50', active: 'bg-pink-500' },
    2: { label: 'N', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', glow: 'shadow-emerald-500/50', active: 'bg-emerald-500' },
    3: { label: 'G', color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', glow: 'shadow-yellow-500/50', active: 'bg-yellow-500' },
    4: { label: 'O', color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/20', glow: 'shadow-red-500/50', active: 'bg-red-500' },
}

const GAME_TRACKS = ['game1.mp3', 'game2.mp3', 'game3.mp3', 'game4.mp3', 'game5.mp3', 'game6.mp3', 'game7.mp3', 'game8.mp3', 'game9.mp3', 'game10.mp3'];

/** Background music level — 50% of device volume */
const BGM_VOLUME = 0.5;

const REWARDS = [
    { id: 'v5', name: '$5 Visa Card', jsCost: 250_000, type: 'Visa' as const },
    { id: 'a5', name: '$5 Amazon Gift', jsCost: 250_000, type: 'Amazon' as const },
    { id: 'p5', name: '$5 PayPal Cash', jsCost: 250_000, type: 'PayPal' as const },
    { id: 'v10', name: '$10 Visa Card', jsCost: 500_000, type: 'Visa' as const },
    { id: 'a10', name: '$10 Amazon Gift', jsCost: 500_000, type: 'Amazon' as const },
    { id: 'p10', name: '$10 PayPal Cash', jsCost: 500_000, type: 'PayPal' as const },
    { id: 'v25', name: '$25 Visa Card', jsCost: 1_250_000, type: 'Visa' as const },
    { id: 'a25', name: '$25 Amazon Gift', jsCost: 1_250_000, type: 'Amazon' as const },
    { id: 'p25', name: '$25 PayPal Cash', jsCost: 1_250_000, type: 'PayPal' as const },
];

export default function BingoXGame() {
    const { user, profile, loading, signIn, signUp, signOut, addJS, supabase } = useAuth()
    const { purchase, isReady: billingReady } = useBilling()

    const [activeTab, setActiveTab] = useState<'play' | 'shop' | 'payout' | 'catalog' | 'how_to_play'>('play')
    const [isMuted, setIsMuted] = useState(false)
    const [showBingoCelebration, setShowBingoCelebration] = useState(false)

    // Game State
    const [board, setBoard] = useState<BingoCell[][]>(BingoEngine.generateBoard())
    const [calledNumbers, setCalledNumbers] = useState<number[]>([])
    const [currentCall, setCurrentCall] = useState<number | null>(null)
    const [sessionScore, setSessionScore] = useState(0)
    const [isAutoPlaying, setIsAutoPlaying] = useState(false)
    const [gameOver, setGameOver] = useState(false)
    const [winType, setWinType] = useState<string | null>(null)
    const [progress, setProgress] = useState(0)
    const [timeLeft, setTimeLeft] = useState(CONFIG.ROUND_TIME_LIMIT)
    const [isProcessing, setIsProcessing] = useState(false)
    const [completedPatterns, setCompletedPatterns] = useState<string[]>([])
    const [hasAwardedX, setHasAwardedX] = useState(false)
    const [hasAwardedFullHouse, setHasAwardedFullHouse] = useState(false)
    const [roundCounter, setRoundCounter] = useState(0)
    const [isPausedForAd, setIsPausedForAd] = useState(false)
    const wasAutoPlayingRef = useRef(false)
    const [leaderboard, setLeaderboard] = useState<any[]>([])
    const [isRedeeming, setIsRedeeming] = useState(false)

    // Audio Refs
    const bgmRef = useRef<HTMLAudioElement | null>(null)
    const callerRef = useRef<HTMLAudioElement | null>(null)
    const isMutedRef = useRef(false)
    const isPausedForAdRef = useRef(false)

    const pauseGameForAd = useCallback(() => {
        isPausedForAdRef.current = true
        wasAutoPlayingRef.current = isAutoPlaying
        setIsPausedForAd(true)
        setIsAutoPlaying(false)
        if (bgmRef.current) bgmRef.current.pause()
        if (callerRef.current) {
            callerRef.current.pause()
            callerRef.current.currentTime = 0
        }
    }, [isAutoPlaying])

    const resumeGameAfterAd = useCallback(() => {
        isPausedForAdRef.current = false
        setIsPausedForAd(false)
        if (wasAutoPlayingRef.current && !gameOver) {
            setIsAutoPlaying(true)
        }
        if (bgmRef.current && !isMutedRef.current) {
            bgmRef.current.play().catch(() => {})
        }
    }, [gameOver])

    useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);

    useEffect(() => {
        if (!user || isPausedForAd) return;
        if (!bgmRef.current) bgmRef.current = new Audio();
        bgmRef.current.loop = true;
        bgmRef.current.muted = isMuted;
        bgmRef.current.volume = BGM_VOLUME;
        let track = "/audio/bgm/login.mp3";
        if (activeTab === 'play' && isAutoPlaying) {
            const randomGame = GAME_TRACKS[Math.floor(Math.random() * GAME_TRACKS.length)];
            track = `/audio/bgm/${randomGame}`;
        }
        if (!bgmRef.current.src.endsWith(track)) {
            bgmRef.current.src = track;
            bgmRef.current.play().catch(() => {});
        }
    }, [user, activeTab, isAutoPlaying, isMuted, roundCounter, isPausedForAd]);

    const playCall = useCallback((num: number) => {
        if (isMutedRef.current || isPausedForAdRef.current) return;
        if (callerRef.current) { callerRef.current.pause(); callerRef.current.currentTime = 0; }
        let prefix = num <= 15 ? "B" : num <= 30 ? "I" : num <= 45 ? "N" : num <= 60 ? "G" : "O";
        const audio = new Audio(`/audio/calls/${prefix}-${num}.MP3`);
        audio.muted = isMutedRef.current;
        callerRef.current = audio;
        audio.play().catch(() => {});
    }, []);

    const processWins = useCallback((winResult: any) => {
        let extra = 0;
        let triggered = false;

        winResult.patterns.forEach((p: any) => {
            const key = p.join(',');
            if (!completedPatterns.includes(key)) {
                setCompletedPatterns(prev => [...prev, key]);
                extra += 500; // js points for session
                triggered = true;
                toast.success(`BINGO! +500 pts`, { icon: '🔥' });
            }
        });

        if (winResult.isXPattern && !hasAwardedX) {
            extra += 1000;
            setHasAwardedX(true); triggered = true;
            toast.success(`X-PATTERN! +1,000 pts`, { icon: '💎', duration: 4000 });
        }

        if (winResult.isFullHouse && !hasAwardedFullHouse) {
            extra += 5000;
            setHasAwardedFullHouse(true); triggered = true;
            toast.success(`FULL HOUSE! +5,000 pts`, { icon: '🏆', duration: 5000 });
            setTimeout(() => { endGame("FULL HOUSE"); }, 2000);
        }

        if (triggered) {
            new Audio('/audio/sfx/bingo.mp3').play().catch(() => {});
            setShowBingoCelebration(true);
            setTimeout(() => setShowBingoCelebration(false), 3500);
            setSessionScore(prev => prev + extra);
        }
    }, [completedPatterns, hasAwardedX, hasAwardedFullHouse]);

    const pickNumber = useCallback(() => {
        if (gameOver || !isAutoPlaying || hasAwardedFullHouse || isPausedForAd) return;
        setCalledNumbers(prev => {
            const rem = Array.from({length:75},(_,i)=>i+1).filter(n=>!prev.includes(n));
            if (rem.length === 0) { endGame("BOARD FULL"); return prev; }
            const next = rem[Math.floor(Math.random()*rem.length)];
            setCurrentCall(next); setProgress(0); playCall(next);
            return [next, ...prev];
        });
    }, [gameOver, isAutoPlaying, playCall, hasAwardedFullHouse, isPausedForAd]);

    useEffect(() => {
        let i: any; if (isAutoPlaying && !gameOver && !isPausedForAd && activeTab === 'play') i = setInterval(pickNumber, 3500);
        return () => clearInterval(i);
    }, [isAutoPlaying, gameOver, isPausedForAd, activeTab, pickNumber]);

    useEffect(() => {
        let t: any; if (isAutoPlaying && !gameOver && !isPausedForAd && activeTab === 'play' && timeLeft > 0) t = setInterval(() => {
            setTimeLeft(p => { if (p <= 1) { endGame(sessionScore > 0 ? "TIME'S UP!" : "GAME OVER"); return 0; } return p - 1; });
        }, 1000);
        return () => clearInterval(t);
    }, [isAutoPlaying, gameOver, isPausedForAd, activeTab, timeLeft, sessionScore]);

    useEffect(() => {
        if (isAutoPlaying && activeTab === 'play' && !isPausedForAd) {
            const t = setInterval(() => setProgress(p => (p >= 100 ? 0 : p + 2.86)), 100);
            return () => clearInterval(t);
        }
    }, [isAutoPlaying, activeTab, isPausedForAd]);

    const endGame = async (msg: string) => {
        pauseGameForAd();
        setGameOver(true);
        setWinType(msg);
        if (sessionScore > 0) {
            toast.promise(addJS(sessionScore), {
                loading: 'Syncing JS...',
                success: 'Score saved to Bank!',
                error: 'Sync failed'
            });
        }
        if (Capacitor.isNativePlatform()) {
            await hideBannerAd();
            await showInterstitial();
            await showBannerAd();
        }
        resumeGameAfterAd();
    };

    useEffect(() => {
        if (!Capacitor.isNativePlatform()) return;
        initAds().then(() => showBannerAd()).catch(() => {});
    }, []);

    useEffect(() => {
        if (!Capacitor.isNativePlatform()) return;
        showBannerAd().catch(() => {});
    }, [activeTab]);

    const handleLuckyDaub = async () => {
        if (gameOver || isProcessing || isPausedForAd) return;
        setIsProcessing(true);
        pauseGameForAd();

        if (Capacitor.isNativePlatform()) {
            await hideBannerAd();
        } else {
            toast.info("Simulating ad for web testing...");
            await new Promise(r => setTimeout(r, 1500));
        }

        const ad = await showRewardedAd();
        if (!ad.success) {
            if (Capacitor.isNativePlatform()) await showBannerAd();
            resumeGameAfterAd();
            setIsProcessing(false);
            return;
        }

        setBoard(prev => {
            const next = [...prev];
            const availableCells: any[] = [];
            next.forEach((row, r) => row.forEach((cell, c) => {
                if (!cell.marked && cell.number !== "FREE") {
                    availableCells.push({ r, c });
                }
            }));
            if (availableCells.length > 0) {
                availableCells.sort(() => Math.random() - 0.5)
                    .slice(0, 2)
                    .forEach(pos => {
                        next[pos.r][pos.c] = { ...next[pos.r][pos.c], marked: true };
                    });
                processWins(BingoEngine.checkWins(next));
            }
            return next;
        });
        toast.success("LUCKY DAUB!", { description: "2 random numbers marked!", icon: '✨' });
        if (Capacitor.isNativePlatform()) await showBannerAd();
        resumeGameAfterAd();
        setIsProcessing(false);
    }

    const nextRound = async () => {
        setBoard(BingoEngine.generateBoard()); setCalledNumbers([]); setCurrentCall(null);
        setGameOver(false); setWinType(null); setIsAutoPlaying(false);
        setTimeLeft(CONFIG.ROUND_TIME_LIMIT); setSessionScore(0); setCompletedPatterns([]);
        setHasAwardedX(false); setHasAwardedFullHouse(false);
        setRoundCounter(prev => prev + 1);
    }

    useEffect(() => {
        if (activeTab === 'payout' && supabase) {
            supabase.from('profiles').select('username, cash_balance, total_earned')
                .or('cash_balance.gt.0,total_earned.gt.0')
                .order('total_earned', { ascending: false }).limit(10)
                .then(({ data }) => { if (data) setLeaderboard(data); });
        }
    }, [activeTab, supabase]);

    const markCell = (r: number, c: number) => {
        if (gameOver) return;
        const cell = board[r][c];
        if (cell.number === "FREE" || calledNumbers.includes(cell.number as number)) {
            if (cell.marked) return;
            const nb = [...board]; nb[r][c].marked = true; setBoard(nb);
            let earned = 10 + Math.floor((100 - progress) * 0.5);
            setSessionScore(prev => prev + earned);
            processWins(BingoEngine.checkWins(nb));
        }
    }

    const handlePayoutRequest = async (reward: typeof REWARDS[number]) => {
        const jsBalance = profile?.jackpot_score || 0;
        if (jsBalance < reward.jsCost || isRedeeming) return;
        if (!confirm(`Redeem ${reward.name} for ${reward.jsCost.toLocaleString()} JS?`)) return;
        setIsRedeeming(true);
        try {
            const { error } = await supabase.from('payout_requests').insert({
                user_id: user?.id,
                reward_name: reward.name,
                points_cost: reward.jsCost,
                status: 'pending',
            });
            if (error) throw error;
            await addJS(-reward.jsCost);
            toast.success("Redemption Submitted!", {
                description: "Payouts are processed within 24–48 hours.",
            });
        } catch (e: any) {
            console.error(e);
            toast.error("Redemption failed");
        } finally {
            setIsRedeeming(false);
        }
    }

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [usernameInput, setUsernameInput] = useState('');
    const [isLogin, setIsLogin] = useState(true);
    const [showPass, setShowPass] = useState(false);
    const [agreed, setAgreed] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (loading) return <div className="h-screen w-full bg-[#050510] flex items-center justify-center text-white"><Loader2 className="animate-spin text-primary" /></div>;

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting) return;
        if (!isLogin && !agreed) { toast.error("Please agree to the terms."); return; }
        setIsSubmitting(true);
        try {
            if (isLogin) await signIn(email, password);
            else await signUp(email, password, usernameInput);
        } catch (error: any) {
            toast.error(error.message || "Authentication failed");
        } finally { setIsSubmitting(false); }
    };

    if (!user) {
        return (
            <div className="h-screen w-full bg-[#050510] flex flex-col items-center justify-center p-8 text-white relative text-left overflow-hidden">
                <div className="absolute inset-0 z-0">
                    <img src="/background.png" className="w-full h-full object-cover opacity-45" alt="" />
                    <div className="absolute inset-0 bg-[#050510]/75" />
                </div>
                <div className="relative z-10 w-full max-w-sm flex flex-col items-center">
                    <img src="logo.png" className="w-48 h-48 mb-6 drop-shadow-glow" alt="Logo" />
                    <h1 className="text-5xl font-black italic mb-2 text-primary tracking-tighter uppercase text-center leading-none w-full">Bingo X</h1>
                    <p className="text-white/40 uppercase tracking-[0.4em] text-[9px] mb-12 font-bold text-center w-full">Skill Edition</p>
                    <form onSubmit={handleAuth} className="w-full space-y-3">
                        {!isLogin && (
                            <div className="bg-white/5 border border-white/10 rounded-2xl flex items-center px-4 py-4 backdrop-blur-sm">
                                <UserIcon className="h-5 w-5 text-white/40 mr-3" />
                                <input type="text" placeholder="Username" className="bg-transparent outline-none w-full font-bold text-white" value={usernameInput} onChange={e => setUsernameInput(e.target.value)} required />
                            </div>
                        )}
                        <div className="bg-white/5 border border-white/10 rounded-2xl flex items-center px-4 py-4 backdrop-blur-sm">
                            <Mail className="h-5 w-5 text-white/40 mr-3" />
                            <input type="email" placeholder="Email" className="bg-transparent outline-none w-full font-bold text-white" value={email} onChange={e => setEmail(e.target.value)} required />
                        </div>
                        <div className="bg-white/5 border border-white/10 rounded-2xl flex items-center px-4 py-4 backdrop-blur-sm">
                            <Lock className="h-5 w-5 text-white/40 mr-3" />
                            <input type={showPass ? "text" : "password"} placeholder="Password" name="password" className="bg-transparent outline-none w-full font-bold text-white" value={password} onChange={e => setPassword(e.target.value)} required />
                            <button type="button" onClick={() => setShowPass(!showPass)}>{showPass ? <EyeOff className="h-4 w-4 opacity-30" /> : <Eye className="h-4 w-4 opacity-30" />}</button>
                        </div>
                        {!isLogin && (
                            <div className="flex items-start gap-3 px-2 py-2">
                                <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} className="accent-primary mt-0.5" />
                                <span className="text-[10px] text-white/40 font-bold uppercase leading-relaxed">
                                    18+ / I agree to the{' '}
                                    <a href="https://mybingox.fun/terms" target="_blank" rel="noopener noreferrer" className="text-primary underline">Terms</a>
                                    {' '}and{' '}
                                    <a href="https://mybingox.fun/privacy" target="_blank" rel="noopener noreferrer" className="text-primary underline">Privacy Policy</a>
                                </span>
                            </div>
                        )}
                        <button type="submit" disabled={isSubmitting} className="w-full bg-primary py-5 rounded-3xl font-black uppercase tracking-widest shadow-glow mt-4 active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-2">
                            {isSubmitting && <Loader2 className="h-5 w-5 animate-spin" />}
                            {isLogin ? 'Login' : 'Create Account'}
                        </button>
                        <button type="button" onClick={() => setIsLogin(!isLogin)} className="w-full text-center text-[10px] text-white/20 font-black uppercase mt-6 tracking-widest italic">{isLogin ? "Join the X Empire" : "Back to Login"}</button>
                    </form>
                </div>
            </div>
        )
    }

    return (
        <div className="h-screen w-full bg-[#02020a] text-white font-sans flex flex-col items-center overflow-hidden relative">
            <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
                <img src="/background.png" className="absolute inset-0 w-full h-full object-cover opacity-45" alt="" />
                <div className="absolute inset-0 bg-[#02020a]/70" />
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 animate-float-slow opacity-25">
                    <span className="text-[min(72vw,380px)] font-black italic leading-none text-cyan-400 shadow-x-glow select-none">X</span>
                </div>
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.06),transparent_65%)]" />
            </div>

            <div className="flex-1 w-full max-w-md flex flex-col items-center z-10 overflow-y-auto px-4 pt-10 pb-40 no-scrollbar">
                {activeTab === 'play' && (
                    <>
                        <div className="w-full flex justify-between items-start mb-6 px-2 text-left">
                            <div className="flex flex-col gap-2">
                                <button onClick={() => setIsMuted(!isMuted)} className="p-3 bg-white/5 backdrop-blur-md rounded-xl border border-white/10 active:scale-90">
                                    {isMuted ? <VolumeX className="h-5 w-5 text-white/40" /> : <Volume2 className="h-5 w-5 text-primary" />}
                                </button>
                                <button onClick={() => signOut()} className="p-3 bg-white/5 backdrop-blur-md rounded-xl border border-white/10 active:scale-90 text-red-500">
                                    <LogOut className="h-5 w-5" />
                                </button>
                            </div>
                            <div className="flex flex-col items-end gap-3 text-right">
                                <div className="bg-white/5 border border-white/10 px-5 py-3 rounded-[24px] flex flex-col items-end backdrop-blur-xl shadow-2xl relative overflow-hidden group">
                                    <div className="absolute top-0 left-0 w-1 h-full bg-primary/40" />
                                    <div className="text-[9px] uppercase font-black opacity-30 mb-1 tracking-widest">Account Bank</div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 bg-yellow-400 rounded-full shadow-[0_0_10px_#facc15]" />
                                        <span className="text-2xl font-black italic tracking-tighter text-white">{(profile?.jackpot_score || 0).toLocaleString()}</span>
                                        <span className="text-[10px] font-black text-white/40">JS</span>
                                    </div>
                                </div>
                                <div className="bg-primary/10 px-4 py-1.5 rounded-full text-[11px] font-black italic text-primary border border-primary/30 shadow-glow">ROUND PTS: {sessionScore.toLocaleString()}</div>
                                <div className={cn("flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black italic border", timeLeft < 20 ? "text-red-500 border-red-500 animate-pulse bg-red-500/10" : "text-white/60 border-white/10 bg-white/5")}>
                                    <Clock className="h-3 w-3" />
                                    {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                                </div>
                            </div>
                        </div>

                        <div className="w-full mb-4 text-left">
                            <div className="bg-gradient-to-b from-white/10 to-transparent border border-white/10 rounded-[35px] p-6 flex items-center justify-between shadow-2xl backdrop-blur-md relative">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black opacity-30 uppercase tracking-[0.2em] mb-1 flex items-center gap-2"><Target className="h-3 w-3" /> Next Ball</span>
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
                                    <div className="absolute inset-0 flex items-center justify-center">{isAutoPlaying ? <Flame className="h-6 w-6 text-primary animate-pulse" /> : <Play className="h-6 w-6 text-white/20" />}</div>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-2 mb-6 opacity-60 text-left w-full px-2">
                            <History className="h-4 w-4 mr-2" />
                            {calledNumbers.slice(1, 6).map((n, i) => (
                                <div key={i} className="text-[10px] font-black border border-white/10 px-2 py-1 rounded-md bg-white/5">{n}</div>
                            ))}
                        </div>

                        <div className={cn("relative p-2 rounded-[45px] bg-black border-4 shadow-2xl mb-8 transition-colors duration-500", "border-white/5")}>
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
                                onClick={handleLuckyDaub}
                                disabled={isProcessing}
                                className="flex-1 py-4 bg-purple-600/20 border-2 border-purple-500/40 rounded-3xl flex items-center justify-center gap-2 font-black italic uppercase text-xs active:scale-95 transition-all disabled:opacity-50"
                            >
                                {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 text-purple-400" />}
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
                        <div className="space-y-4 px-2">
                            <div className="bg-white/5 border border-white/10 p-6 rounded-[40px] flex justify-between items-center shadow-xl text-left">
                                <div className="flex flex-col">
                                    <span className="font-black text-xl italic uppercase leading-none mb-1">Double JS</span>
                                    <span className="text-[10px] opacity-40 font-bold uppercase tracking-widest">Permanent 2x Points</span>
                                </div>
                                <button onClick={() => purchase(PRODUCT_DOUBLE_JS)} disabled={!billingReady} className="bg-primary text-black font-black px-6 py-3 rounded-2xl shadow-glow active:scale-95 transition-transform disabled:opacity-50">
                                    {billingReady ? '$4.99' : 'Loading...'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'payout' && (
                    <div className="w-full py-4 animate-in slide-in-from-right duration-300 text-left">
                        <header className="px-2 pb-6 flex items-center gap-3">
                            <h1 className="text-xl font-black uppercase italic tracking-tighter">
                                THE <span className="text-cyan-400">JACKPOT VAULT</span>
                            </h1>
                        </header>

                        <div className="bg-gradient-to-br from-[#111827] to-black border border-white/10 rounded-[2rem] p-8 text-center shadow-2xl relative overflow-hidden mb-6">
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <Wallet className="w-24 h-24 rotate-12 text-cyan-400" />
                            </div>
                            <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-1 italic">
                                Total Jackpot Balance
                            </p>
                            <p className="text-6xl font-black tracking-tighter text-white tabular-nums italic">
                                {(profile?.jackpot_score || 0).toLocaleString()}
                            </p>
                            <p className="text-[10px] text-cyan-400 font-bold mt-2 uppercase tracking-widest">
                                JS · Redemption Ready
                            </p>
                        </div>

                        <div className="space-y-3 px-1">
                            <h3 className="text-[10px] font-black text-white/40 uppercase tracking-widest px-2 italic">
                                Select Reward
                            </h3>
                            {REWARDS.map((r) => {
                                const jsBalance = profile?.jackpot_score || 0;
                                const isUnlocked = jsBalance >= r.jsCost;
                                const Icon = r.type === 'PayPal' ? Wallet : CreditCard;
                                const iconBg =
                                    r.type === 'Amazon'
                                        ? 'bg-primary'
                                        : r.type === 'PayPal'
                                          ? 'bg-emerald-600'
                                          : 'bg-cyan-600';

                                return (
                                    <div
                                        key={r.id}
                                        className={cn(
                                            "rounded-3xl border p-5 flex items-center justify-between transition-all",
                                            isUnlocked
                                                ? "border-cyan-400/30 bg-cyan-400/5"
                                                : "border-white/5 bg-white/5 opacity-50",
                                        )}
                                    >
                                        <div className="flex items-center gap-4 text-left min-w-0">
                                            <div className={cn("h-12 w-12 shrink-0 rounded-2xl flex items-center justify-center shadow-lg text-white", iconBg)}>
                                                <Icon className="w-6 h-6" />
                                            </div>
                                            <div className="min-w-0">
                                                <h4 className="font-black text-sm uppercase italic truncate">{r.name}</h4>
                                                <p className="text-[10px] text-white/40 font-bold uppercase mt-0.5">
                                                    {isUnlocked
                                                        ? "Ready to claim"
                                                        : `Unlock at ${r.jsCost.toLocaleString()} JS`}
                                                </p>
                                            </div>
                                        </div>
                                        {isUnlocked ? (
                                            <button
                                                type="button"
                                                onClick={() => void handlePayoutRequest(r)}
                                                disabled={isRedeeming}
                                                className="shrink-0 bg-primary text-black text-[10px] font-black px-5 py-2.5 rounded-xl shadow-glow active:scale-95 transition-all italic disabled:opacity-50"
                                            >
                                                {isRedeeming ? "..." : "REDEEM"}
                                            </button>
                                        ) : (
                                            <Lock className="w-4 h-4 text-white/20 shrink-0 mr-1" />
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        <div className="flex flex-col items-center gap-4 pt-8 pb-4">
                            <button
                                type="button"
                                onClick={() => window.location.assign('mailto:support@bingox.fun')}
                                className="text-white/30 text-[10px] font-black uppercase tracking-widest underline italic"
                            >
                                Contact Support
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <nav className="fixed bottom-14 left-0 right-0 h-20 bg-[#050510]/95 backdrop-blur-3xl border-t border-white/10 flex justify-around items-center px-4 z-50">
                <NavButton icon={ShoppingBag} label="Store" active={activeTab === 'shop'} onClick={() => setActiveTab('shop')} />
                <NavButton icon={Home} label="Play" active={activeTab === 'play'} onClick={() => setActiveTab('play')} />
                <NavButton icon={Award} label="Wins" active={activeTab === 'payout'} accent="cyan" onClick={() => setActiveTab('payout')} />
            </nav>

            {showBingoCelebration && (
                <div className="fixed inset-0 z-[10000] pointer-events-none flex items-center justify-center overflow-hidden bg-black/20 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="animate-bounce text-7xl font-black italic text-primary drop-shadow-[0_0_30px_rgba(34,211,238,0.8)] uppercase tracking-tighter">BINGO!</div>
                </div>
            )}

            {gameOver && (
                <div className="fixed inset-0 z-[9000] bg-black/95 flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-700 backdrop-blur-md">
                    <Trophy className={cn("h-32 w-32 mb-8 drop-shadow-glow scale-125", sessionScore === 0 ? "text-red-500" : "text-yellow-400")} />
                    <h2 className={cn("text-7xl font-black italic mb-2 uppercase tracking-tighter leading-none", sessionScore === 0 ? "text-red-500" : "text-white")}>{winType}</h2>
                    <div className="bg-white/5 border-2 border-white/10 p-10 rounded-[50px] mb-12 relative overflow-hidden text-center">
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
