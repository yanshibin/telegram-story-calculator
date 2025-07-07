// api/proxy.js
export default async function handler(req, res) {
  // 设置 CORS 头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // 处理 OPTIONS 预检请求
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { url } = req.query;
    
    if (!url) {
      return res.status(400).json({ error: 'URL parameter is required' });
    }

    // 验证 URL 是否为 Telegram 链接
    if (!url.includes('t.me/')) {
      return res.status(400).json({ error: 'Invalid Telegram URL' });
    }

    console.log('Fetching URL:', url);

    // 获取页面内容
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();
    
    // 提取订阅者数量的多种正则表达式
    const patterns = [
      // 匹配 "X members" 或 "X subscribers"
      /(\d{1,3}(?:[,\s]\d{3})*)\s*(?:members|subscribers)/i,
      // 匹配中文 "X 个成员"
      /(\d{1,3}(?:[,\s]\d{3})*)\s*个成员/i,
      // 匹配俄文等其他语言的成员数
      /(\d{1,3}(?:[,\s]\d{3})*)\s*(?:участников|подписчиков)/i,
      // 更通用的数字匹配（在特定上下文中）
      /"subscribers_count":(\d+)/i,
      /"members_count":(\d+)/i
    ];

    let membersCount = null;
    let matchedPattern = '';

    // 尝试所有正则表达式
    for (let i = 0; i < patterns.length; i++) {
      const match = html.match(patterns[i]);
      if (match) {
        // 清理数字字符串，移除逗号和空格
        const cleanNumber = match[1].replace(/[,\s]/g, '');
        membersCount = parseInt(cleanNumber);
        matchedPattern = `Pattern ${i + 1}`;
        console.log(`Found members count: ${membersCount} using ${matchedPattern}`);
        break;
      }
    }

    if (membersCount === null) {
      // 尝试从页面标题或描述中提取
      const titleMatch = html.match(/<title[^>]*>([^<]+)</i);
      const descMatch = html.match(/<meta[^>]*description[^>]*content="([^"]+)"/i);
      
      console.log('Title:', titleMatch ? titleMatch[1] : 'Not found');
      console.log('Description:', descMatch ? descMatch[1] : 'Not found');
      
      return res.status(404).json({ 
        error: 'Could not extract member count',
        debug: {
          title: titleMatch ? titleMatch[1] : null,
          description: descMatch ? descMatch[1] : null,
          htmlLength: html.length,
          containsMembers: html.includes('members'),
          containsSubscribers: html.includes('subscribers')
        }
      });
    }

    // 返回成功结果
    res.status(200).json({
      success: true,
      membersCount: membersCount,
      url: url,
      matchedPattern: matchedPattern
    });

  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch channel data',
      details: error.message 
    });
  }
}
