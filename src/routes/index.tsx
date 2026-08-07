import { useState, useEffect, useRef, useCallback } from 'react'
import { BingoEngine, BingoCell } from '@/logic/BingoEngine'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/use-auth'
import { useBilling, PRODUCT_DOUBLE_JS } from '@/hooks/use-billing'
import { initAds, showRewardedAd, showInterstitial, setBannerVisible } from '@/lib/ads'
import { CONFIG } from '@/config'
import {
    Trophy, Zap, Pause, Play, Flame, Target, Star,
    History, ShoppingBag, Award, Home, User as UserIcon,
    CreditCard, Gift, Mail, Lock, Eye, EyeOff, ArrowLeft, Info, LogOut, Clock,
    CheckCircle2, Loader2, Volume2, VolumeX, Sparkles, Coins
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

const REWARDS = [
    { id: 'v5', name: '$5 Visa Card', jp: 250000, type: 'Visa' },
    { id: 'a5', name: '$5 Amazon Gift', jp: 250000, type: 'Amazon' },
    { id: 'p5', name: '$5 PayPal Cash', jp: 250000, type: 'PayPal' },
    { id: 'v10', name: '$10 Visa Card', jp: 500000, type: 'Visa' },
];

export default function BingoXGame() {
    const { user, profile, loading, signIn, signUp, signOut, addJS, supabase } = useAuth()
    const { purchase } = useBilling(addJS)

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
    const [leaderboard, setLeaderboard] = useState<any[]>([])

    // Audio Refs
    const bgmRef = useRef<HTMLAudioElement | null>(null)
    const callerRef = useRef<HTMLAudioElement | null>(null)
    const isMutedRef = useRef(false)

    useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);

    useEffect(() => {
        if (!user) return;
        if (!bgmRef.current) bgmRef.current = new Audio();
        bgmRef.current.loop = true;
        bgmRef.current.muted = isMuted;
        let track = "/audio/bgm/login.mp3";
        if (activeTab === 'play' && isAutoPlaying) {
            const randomGame = GAME_TRACKS[Math.floor(Math.random() * GAME_TRACKS.length)];
            track = `/audio/bgm/${randomGame}`;
        }
        if (!bgmRef.current.src.endsWith(track)) {
            bgmRef.current.src = track;
            bgmRef.current.play().catch(() => {});
        }
    }, [user, activeTab, isAutoPlaying, isMuted, roundCounter]);

    const playCall = useCallback((num: number) => {
        if (isMutedRef.current) return;
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
                extra += CONFIG.BINGO_BONUS;
                triggered = true;
                toast.success(`BINGO! +${CONFIG.BINGO_BONUS.toLocaleString()} JS`, { icon: '🔥' });
            }
        });

        if (winResult.isXPattern && !hasAwardedX) {
            extra += CONFIG.X_PATTERN_BONUS;
            setHasAwardedX(true); triggered = true;
            toast.success(`X-PATTERN! +${CONFIG.X_PATTERN_BONUS.toLocaleString()} JS`, { icon: '💎', duration: 4000 });
        }

        if (winResult.isFullHouse && !hasAwardedFullHouse) {
            extra += 50000;
            setHasAwardedFullHouse(true); triggered = true;
            toast.success(`FULL HOUSE! +50,000 JS`, { icon: '🏆', duration: 5000 });
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
        if (gameOver || !isAutoPlaying || hasAwardedFullHouse) return;
        setCalledNumbers(prev => {
            const rem = Array.from({length:75},(_,i)=>i+1).filter(n=>!prev.includes(n));
            if (rem.length === 0) { endGame("BOARD FULL"); return prev; }
            const next = rem[Math.floor(Math.random()*rem.length)];
            setCurrentCall(next); setProgress(0); playCall(next);
            return [next, ...prev];
        });
    }, [gameOver, isAutoPlaying, playCall, hasAwardedFullHouse]);

    useEffect(() => {
        let i: any; if (isAutoPlaying && !gameOver && activeTab === 'play') i = setInterval(pickNumber, 3500);
        return () => clearInterval(i);
    }, [isAutoPlaying, gameOver, activeTab, pickNumber]);

    useEffect(() => {
        let t: any; if (isAutoPlaying && !gameOver && activeTab === 'play' && timeLeft > 0) t = setInterval(() => {
            setTimeLeft(p => { if (p <= 1) { endGame(sessionScore > 0 ? "TIME'S UP!" : "GAME OVER"); return 0; } return p - 1; });
        }, 1000);
        return () => clearInterval(t);
    }, [isAutoPlaying, gameOver, activeTab, timeLeft, sessionScore]);

    useEffect(() => {
        if (isAutoPlaying && activeTab === 'play') {
            const t = setInterval(() => setProgress(p => (p >= 100 ? 0 : p + 2.86)), 100);
            return () => clearInterval(t);
        }
    }, [isAutoPlaying, activeTab]);

    const endGame = async (msg: string) => {
        setGameOver(true); setWinType(msg); setIsAutoPlaying(false);
        if (sessionScore > 0) {
            toast.promise(addJS(sessionScore), {
                loading: 'Syncing score...',
                success: 'Score saved to Bank!',
                error: 'Sync failed'
            });
        }
        showInterstitial();
    };

    useEffect(() => {
        if (Capacitor.isNativePlatform()) {
            initAds();
            setBannerVisible(true);
        }
    }, []);

    const handleLuckyDaub = async () => {
        if (gameOver || isProcessing) return;
        setIsProcessing(true);

        if (!Capacitor.isNativePlatform()) {
            toast.info("Simulating ad for web testing...");
            await new Promise(r => setTimeout(r, 1500));
        }

        const ad = await showRewardedAd();
        if (!ad.success) {
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
            supabase.from('profiles').select('username, jackpot_score, total_earned')
                .or('jackpot_score.gt.0,total_earned.gt.0')
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
            let earned = CONFIG.POINTS_PER_DAUB + Math.floor((100 - progress) * 5);
            setSessionScore(prev => prev + earned);
            processWins(BingoEngine.checkWins(nb));
        }
    }

    const handlePayoutRequest = async (reward: any) => {
        if ((profile?.jackpot_score || 0) < reward.jp) return;
        if (!confirm(`Redeem ${reward.jp.toLocaleString()} JS for a ${reward.name}?`)) return;
        try {
            const { error } = await supabase.from('payout_requests').insert({ user_id: user?.id, reward_name: reward.name, points_cost: reward.jp, status: 'pending' });
            if (error) throw error;
            await addJS(-reward.jp);
            toast.success("Redemption Submitted!");
        } catch (e: any) { console.error(e); }
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
            <div className="h-screen w-full bg-[#050510] flex flex-col items-center justify-center p-8 text-white relative text-left">
                <img src="logo.png" className="w-48 h-48 mb-6 drop-shadow-glow" alt="Logo" />
                <h1 className="text-5xl font-black italic mb-2 text-primary tracking-tighter uppercase text-center leading-none w-full">Bingo X</h1>
                <p className="text-white/40 uppercase tracking-[0.4em] text-[9px] mb-12 font-bold text-center w-full">Skill Edition</p>
                <form onSubmit={handleAuth} className="w-full max-w-sm space-y-3">
                    {!isLogin && (
                        <div className="bg-white/5 border border-white/10 rounded-2xl flex items-center px-4 py-4">
                            <UserIcon className="h-5 w-5 text-white/40 mr-3" />
                            <input type="text" placeholder="Username" className="bg-transparent outline-none w-full font-bold text-white" value={usernameInput} onChange={e => setUsernameInput(e.target.value)} required />
                        </div>
                    )}
                    <div className="bg-white/5 border border-white/10 rounded-2xl flex items-center px-4 py-4">
                        <Mail className="h-5 w-5 text-white/40 mr-3" />
                        <input type="email" placeholder="Email" className="bg-transparent outline-none w-full font-bold text-white" value={email} onChange={e => setEmail(e.target.value)} required />
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-2xl flex items-center px-4 py-4">
                        <Lock className="h-5 w-5 text-white/40 mr-3" />
                        <input type={showPass ? "text" : "password"} placeholder="Password" name="password" className="bg-transparent outline-none w-full font-bold text-white" value={password} onChange={e => setPassword(e.target.value)} required />
                        <button type="button" onClick={() => setShowPass(!showPass)}>{showPass ? <EyeOff className="h-4 w-4 opacity-30" /> : <Eye className="h-4 w-4 opacity-30" />}</button>
                    </div>
                    {!isLogin && (
                        <div className="flex items-center gap-3 px-2 py-2">
                            <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} className="accent-primary" />
                            <span className="text-[10px] text-white/40 font-bold uppercase">18+ / Agree to Terms</span>
                        </div>
                    )}
                    <button type="submit" disabled={isSubmitting} className="w-full bg-primary py-5 rounded-3xl font-black uppercase tracking-widest shadow-glow mt-4 active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-2">
                        {isSubmitting && <Loader2 className="h-5 w-5 animate-spin" />}
                        {isLogin ? 'Login' : 'Create Account'}
                    </button>
                    <button type="button" onClick={() => setIsLogin(!isLogin)} className="w-full text-center text-[10px] text-white/20 font-black uppercase mt-6 tracking-widest italic">{isLogin ? "Join the X Empire" : "Back to Login"}</button>
                </form>
            </div>
        )
    }

    return (
        <div className="h-screen w-full bg-[#02020a] text-white font-sans flex flex-col items-center overflow-hidden relative">
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
                <span className="text-[90vh] font-black italic opacity-[0.12] shadow-x-glow animate-float-slow select-none">X</span>
            </div>

            <div className="flex-1 w-full max-w-md flex flex-col items-center z-10 overflow-y-auto px-4 pt-10 pb-32 no-scrollbar">
                {activeTab === 'play' && (
                    <>
                        <div className="w-full flex justify-between items-start mb-6 px-2 text-left">
                            <div className="flex flex-col gap-2">
                                <button onClick={() => setIsMuted(!isMuted)} className="p-3 bg-white/5 rounded-xl border border-white/10 active:scale-90">
                                    {isMuted ? <VolumeX className="h-5 w-5 text-white/40" /> : <Volume2 className="h-5 w-5 text-primary" />}
                                </button>
                                <button onClick={() => signOut()} className="p-3 bg-white/5 rounded-xl border border-white/10 active:scale-90 text-red-500">
                                    <LogOut className="h-5 w-5" />
                                </button>
                            </div>
                            <div className="flex flex-col items-end gap-3 text-right">
                                <div className="bg-white/5 border border-white/10 px-5 py-3 rounded-[24px] flex flex-col items-end backdrop-blur-xl shadow-2xl relative overflow-hidden group">
                                    <div className="absolute top-0 left-0 w-1 h-full bg-primary/40" />
                                    <div className="text-[9px] uppercase font-black opacity-30 mb-1 tracking-widest">Account Bank</div>
                                    <div className="flex items-center gap-2">
                                        <Zap className="h-4 w-4 text-yellow-400 fill-yellow-400 drop-shadow-glow" />
                                        <span className="text-2xl font-black italic tracking-tighter text-white">{(profile?.jackpot_score || 0).toLocaleString()} JS</span>
                                    </div>
                                </div>
                                <div className="bg-primary/10 px-4 py-1.5 rounded-full text-[11px] font-black italic text-primary border border-primary/30 shadow-glow">ROUND: {sessionScore.toLocaleString()}</div>
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
                                <button onClick={() => purchase(PRODUCT_DOUBLE_JS)} className="bg-primary text-black font-black px-6 py-3 rounded-2xl shadow-glow active:scale-95 transition-transform">$4.99</button>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'payout' && (
                    <div className="w-full py-8 animate-in slide-in-from-right duration-300 px-2 text-left">
                        <h2 className="text-5xl font-black italic uppercase tracking-tighter mb-8 text-emerald-400 text-center">Wins</h2>
                        <div className="bg-gradient-to-br from-emerald-900 to-green-950 p-8 rounded-[50px] border-2 border-emerald-500/20 shadow-2xl relative overflow-hidden group mb-6">
                             <div className="flex justify-between items-start">
                                <Gift className="h-12 w-12 text-emerald-400 mb-4" />
                                <div className="bg-black/40 px-4 py-2 rounded-2xl border border-white/10 text-right backdrop-blur-md">
                                    <div className="text-[8px] uppercase font-black opacity-60 text-emerald-400">Account Bank</div>
                                    <div className="text-xl font-black italic text-white">{(profile?.jackpot_score || 0).toLocaleString()} JS</div>
                                </div>
                             </div>
                             <h3 className="text-2xl font-black uppercase italic leading-none mb-2">Jackpot Rewards</h3>
                             <p className="text-[10px] text-white/60 font-bold uppercase tracking-widest mb-6">Redeem points for real world money</p>
                             <div className="grid grid-cols-1 gap-2">
                                {REWARDS.map(r => (
                                    <div key={r.id} onClick={() => handlePayoutRequest(r)} className={cn("bg-black/40 border p-4 rounded-2xl flex justify-between items-center", (profile?.jackpot_score || 0) >= r.jp ? "border-emerald-500/50" : "border-white/5 opacity-40")}>
                                        <span className="font-black italic uppercase text-xs">{r.name}</span>
                                        <span className="text-[9px] font-bold">{r.jp.toLocaleString()} JS</span>
                                    </div>
                                ))}
                             </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 mt-12 text-center">
                            <button onClick={() => window.location.assign('mailto:support@bingox.fun')} className="bg-white/5 border border-white/10 py-4 rounded-2xl font-black uppercase text-[10px] text-primary col-span-2">Contact Support</button>
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
