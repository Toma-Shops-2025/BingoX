
Commands to Update GitHub (if you make more changes later):
If you ever want to push changes for all of them at once manually, here are the separate commands:
For ViralSnap:
1.
cd "$env:USERPROFILE\Desktop\viralsnap"
2.
git add .
3.
git commit -m "Correct Netlify publish directory to .output/public"
4.
git push
For MyRunner:
1.
cd "$env:USERPROFILE\Desktop\myrunner"
2.
git add .
3.
git commit -m "Correct Netlify publish directory to .output/public"
4.
git push
For AlgoRhythm:
1.
cd "$env:USERPROFILE\Desktop\algorhythm"
2.
git add .
3.
git commit -m "Correct Netlify publish directory to .output/public"
4.
git push





import { createClient } from '@supabase/supabase-js'

// REPLACE THESE WITH YOUR BINGO X SUPABASE PROJECT CREDENTIALS
const supabaseUrl = 'https://vujmezepstugbhozgtrm.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ1am1lemVwc3R1Z2Job3pndHJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3MzI3OTAsImV4cCI6MjA5OTMwODc5MH0.C1pvdemMhaBUD4GDCZ8IePitR6F18JH-QAmkKN9qXcg'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
