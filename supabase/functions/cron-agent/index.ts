import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing Supabase credentials');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: tasks, error: fetchError } = await supabase
      .from('scheduled_tasks')
      .select('*')
      .eq('is_active', true);

    if (fetchError) throw fetchError;

    const now = new Date();
    const tasksToRun = tasks.filter(task => {
      if (!task.last_run_at) return true;
      const lastRun = new Date(task.last_run_at);
      const diffHours = (now.getTime() - lastRun.getTime()) / (1000 * 60 * 60);
      return diffHours >= task.interval_hours;
    });

    const results = [];

    for (const task of tasksToRun) {
      try {
        console.log(`Executing task ${task.id} for user ${task.user_id}`);
        
        const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
        if (!SUPABASE_ANON_KEY) throw new Error('Missing SUPABASE_ANON_KEY env variable');
        
        const agentResponse = await fetch(`${SUPABASE_URL}/functions/v1/agent-process`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify({
            message: `[AUTOMATED TASK: ${task.title}]\n${task.prompt}`,
            tools: task.tools || [],
            model: 'gemini-2.5-flash',
            userId: task.user_id,
            userName: 'Scheduled Agent',
            stream: false
          })
        });

        const agentData = await agentResponse.json();
        
        const aiMessageText = agentData.message || (agentData.error ? `🚨 **Error dari AI:** ${agentData.error}` : 'Gagal mengeksekusi agen.');

        const newConversation = {
          user_id: task.user_id,
          title: `[AUTO] ${task.title} - ${new Date().toLocaleDateString('id-ID')}`,
          messages: [
            { id: Date.now(), type: 'user', content: `[Tugas Otomatis]: ${task.prompt}`, timestamp: new Date().toISOString() },
            { id: Date.now() + 1, type: 'agent', content: aiMessageText, timestamp: new Date().toISOString() }
          ]
        };

        const { error: insertError } = await supabase.from('chats').insert(newConversation);
        if (insertError) console.error('Error saving conversation:', insertError);

        await supabase.from('scheduled_tasks').update({ last_run_at: now.toISOString() }).eq('id', task.id);
        
        const resendKey = Deno.env.get('RESEND_API_KEY');
        if (resendKey) {
          try {
            const { data: userData, error: userError } = await supabase.auth.admin.getUserById(task.user_id);
            if (!userError && userData?.user?.email) {
              const userEmail = userData.user.email;
              const emailHtml = `
                <div style="font-family: sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px;">
                  <h2 style="color: #8b5cf6; margin-top: 0;">🤖 Laporan Mamet AI - Tugas Selesai</h2>
                  <p>Halo! Tugas otomatis Anda <strong>"${task.title}"</strong> baru saja selesai dieksekusi.</p>
                  <div style="background: #1e293b; color: #f8fafc; padding: 15px; border-radius: 8px; border-left: 4px solid #8b5cf6; margin: 20px 0; font-size: 14px; white-space: pre-wrap;">
${aiMessageText.substring(0, 1000)}${aiMessageText.length > 1000 ? '\n\n... (Terpotong, silakan buka aplikasi untuk melihat selengkapnya)' : ''}
                  </div>
                  <p>Buka dashboard aplikasi Mamet Anda untuk melihat riwayat percakapan lengkapnya.</p>
                  <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
                  <p style="font-size: 12px; color: #94a3b8;">Email ini dikirim otomatis oleh Mamet AI Cron Manager.</p>
                </div>
              `;
              
              await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${resendKey}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  from: 'Mamet AI <onboarding@resend.dev>',
                  to: userEmail,
                  subject: `[Mamet] Tugas Selesai: ${task.title}`,
                  html: emailHtml
                })
              });
              console.log(`Auto-Notifier: Email laporan terkirim ke ${userEmail}`);
            }
          } catch (emailErr) {
            console.error('Auto-Notifier Error:', emailErr);
          }
        }

        results.push({ taskId: task.id, status: 'success' });

        await new Promise(r => setTimeout(r, 3000));
      } catch (err) {
        console.error(`Task ${task.id} failed:`, err);
        
        await supabase.from('scheduled_tasks').update({ 
          is_active: false,
          last_run_at: new Date().toISOString()
        }).eq('id', task.id);
        
        console.warn(`HARAKIRI: Tugas ${task.id} dinonaktifkan otomatis karena terjadi error.`);

        results.push({ taskId: task.id, status: 'error', error: err.message, action: 'auto_disabled' });
      }
    }

    const { data: toggleData } = await supabase
      .from('scheduled_tasks')
      .select('is_active')
      .eq('title', 'SYSTEM_SHOPEE_NINJA_TOGGLE')
      .limit(1)
      .maybeSingle();
      
    const isShopeeNinjaEnabled = toggleData ? toggleData.is_active : true;

    if (!isShopeeNinjaEnabled) {
      console.log('Shopee Ninja is globally DISABLED via dashboard. Skipping processing.');
    } else {
      console.log('Shopee Ninja is ENABLED.');
    }

    const isStealthSkip = Math.random() < 0.4;
    
    const shopeeResults = [];

    if (isShopeeNinjaEnabled && !isStealthSkip) {
      const { data: shopeeLinks, error: shopeeError } = await supabase
        .from('shopee_queue')
        .select('*')
        .eq('status', 'pending')
        .limit(1);

      if (!shopeeError && shopeeLinks && shopeeLinks.length > 0) {
        for (const link of shopeeLinks) {
        try {
          console.log(`Processing Shopee Link: ${link.original_url}`);
          const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
          if (!SUPABASE_ANON_KEY) throw new Error('Missing SUPABASE_ANON_KEY');

          let productInfo = '';
          try {
            const jinaRes = await fetch(`https://r.jina.ai/${link.original_url}`, {
              headers: { 'Accept': 'text/markdown', 'X-Return-Format': 'markdown' }
            });
            if (jinaRes.ok) {
              const rawPage = await jinaRes.text();
              productInfo = rawPage.substring(0, 4000);
            }
          } catch (scrapeErr) {
            console.log('Scrape produk gagal (non-fatal), lanjut tanpa detail:', scrapeErr);
          }

          const templates = [
            "Lagi nyari barang murah? Coba cek ini deh, mantul banget buat harga segini: [URL]",
            "Keracunan barang ini gara2 liat review, ternyata beneran bagus. Buat yang mau: [URL]",
            "Awalnya iseng beli, eh malah ketagihan. Kualitasnya oke parah! Cek aja di sini: [URL]",
            "Sumpah ini barang berguna banget, nyesel baru tau sekarang. Linknya: [URL]",
            "Buat yang lagi nyari [NAMA_PRODUK], ini rekomen sih. Mumpung lagi diskon: [URL]"
          ];
          const template = templates[Math.floor(Math.random() * templates.length)];
          const cleanName = (link.product_name || 'barang ini').replace('[AUTO-DISCOVERY]', '').trim();
          const aiMessageText = template.replace('[URL]', link.original_url).replace('[NAMA_PRODUK]', cleanName);

          const teleBotToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
          const teleChatId = Deno.env.get('TELEGRAM_CHAT_ID');

          if (teleBotToken && teleChatId) {
             await fetch(`https://api.telegram.org/bot${teleBotToken}/sendMessage`, {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ chat_id: teleChatId, text: aiMessageText })
             });
          }

          const twitterToken = Deno.env.get('TWITTER_BEARER_TOKEN');
          if (twitterToken) {
             await fetch('https://api.twitter.com/2/tweets', {
               method: 'POST',
               headers: {
                 'Authorization': `Bearer ${twitterToken}`,
                 'Content-Type': 'application/json'
               },
               body: JSON.stringify({ text: aiMessageText.substring(0, 280) })
             });
          }

          const fbToken = Deno.env.get('FACEBOOK_PAGE_TOKEN');
          const fbPageId = Deno.env.get('FACEBOOK_PAGE_ID');
          if (fbToken && fbPageId) {
             await fetch(`https://graph.facebook.com/${fbPageId}/feed`, {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ message: aiMessageText, link: link.original_url, access_token: fbToken })
             });
          }

          await supabase.from('shopee_queue').update({ status: 'posted', posted_at: new Date().toISOString() }).eq('id', link.id);
          shopeeResults.push({ id: link.id, status: 'success' });

          await new Promise(r => setTimeout(r, 3000));
        } catch (err) {
          console.error(`Shopee Queue ${link.id} failed:`, err);
          shopeeResults.push({ id: link.id, status: 'error', error: err.message });
        }
      }
      }
    } else {
      console.log('Stealth Mode Active: Skipping Shopee posting this cycle to simulate unpredictable human schedule.');
    }

    let discoveryResults = [];
    try {
      const { count: pendingCount } = await supabase
        .from('shopee_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      if (isShopeeNinjaEnabled && (pendingCount || 0) < 3) {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const { count: todayDiscoveryCount } = await supabase
          .from('shopee_queue')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', todayStart.toISOString())
          .like('product_name', '%[AUTO-DISCOVERY]%');

        if ((todayDiscoveryCount || 0) === 0) {
          console.log('Auto-Discovery: Antrean menipis, mencari produk laris Shopee...');

          const searchQueries = [
            'site:shopee.co.id produk terlaris minggu ini',
            'site:shopee.co.id flash sale hari ini rekomendasi',
            'site:shopee.co.id best seller murah berkualitas'
          ];
          const randomQuery = searchQueries[Math.floor(Math.random() * searchQueries.length)];
          
          const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(randomQuery)}`;

          const jinaRes = await fetch(`https://r.jina.ai/${searchUrl}`, {
            headers: { 'Accept': 'text/markdown', 'X-Return-Format': 'markdown' }
          });

          if (jinaRes.ok) {
            const searchContent = await jinaRes.text();

            let aiOutput = "[]";
            const urlRegex = /https:\/\/shopee\.co\.id\/[\w\.-]+(?:-i\.\d+\.\d+)?/g;
            const matchedUrls = searchContent.match(urlRegex) || [];
            
            const uniqueUrls = [...new Set(matchedUrls)].filter(url => 
              url.length > 30 && !url.includes('buyer') && !url.includes('cart')
            ).slice(0, 3);
            
            const extractedProducts = uniqueUrls.map(url => ({ 
              url, 
              name: "PRODUK TRENDING TERKINI" 
            }));
            
            aiOutput = JSON.stringify(extractedProducts);
            
              try {
                const cleanJson = aiOutput.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
                const products = JSON.parse(cleanJson);

                if (Array.isArray(products) && products.length > 0) {
                  for (const product of products.slice(0, 3)) {
                    if (product.url && product.url.includes('shopee.co.id')) {
                      const { count: existingCount } = await supabase
                        .from('shopee_queue')
                        .select('*', { count: 'exact', head: true })
                        .eq('original_url', product.url);

                      if ((existingCount || 0) === 0) {
                        const { error: insertErr } = await supabase.from('shopee_queue').insert({
                          original_url: product.url,
                          product_name: `[AUTO-DISCOVERY] ${product.name || 'Produk Shopee'}`,
                          status: 'pending'
                        });
                        if (!insertErr) {
                          discoveryResults.push({ url: product.url, status: 'queued' });
                          console.log(`Auto-Discovery: Berhasil menambahkan ${product.url} ke antrean.`);
                        }
                      } else {
                        console.log(`Auto-Discovery: Skip duplikat ${product.url}`);
                      }
                    }
                  }
                }
              } catch (parseErr) {
                console.error('Auto-Discovery: Gagal parsing output AI:', parseErr);
              }
          }
        } else {
          console.log('Auto-Discovery: Sudah pernah jalan hari ini, skip.');
        }
      } else {
        console.log(`Auto-Discovery: Antrean masih cukup (${pendingCount} pending), skip discovery.`);
      }
    } catch (discoveryErr) {
      console.error('Auto-Discovery Error (non-fatal):', discoveryErr);
    }

    return new Response(JSON.stringify({ 
      executed_tasks: results.length, 
      task_results: results,
      executed_shopee: shopeeResults.length,
      shopee_results: shopeeResults,
      auto_discovery: discoveryResults.length,
      discovery_results: discoveryResults
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
