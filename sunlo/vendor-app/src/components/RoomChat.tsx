import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, TextInput, View } from 'react-native';
import type { RoomChatMsg } from '@/lib/useRoom';
import { colors, font } from '@/theme';
import { Text } from './ui';

/** Room ki live chat: neeche taraf halke background mein messages, aur likhne ki patti */
export function RoomChat({ messages, onSend, placeholder = 'Kuch kahein...', rightSpace = 0 }: { messages: RoomChatMsg[]; onSend: (t: string) => Promise<string | null>; placeholder?: string; rightSpace?: number }) {
  const [text, setText] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const list = useRef<FlatList<RoomChatMsg>>(null);
  useEffect(() => {
    list.current?.scrollToEnd({ animated: true });
  }, [messages.length]);

  async function go() {
    const t = text.trim();
    if (!t) return;
    setText('');
    const e = await onSend(t);
    setErr(e);
    if (e) setTimeout(() => setErr(null), 2500);
  }

  return (
    <View style={{ paddingHorizontal: 12, paddingBottom: 8, gap: 8 }}>
      <FlatList
        ref={list}
        data={messages}
        keyExtractor={(m) => m.id}
        style={{ maxHeight: 180, marginRight: rightSpace }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <View style={{ alignSelf: 'flex-start', maxWidth: '92%', backgroundColor: 'rgba(0,0,0,0.38)', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5, marginTop: 4 }}>
            <Text style={{ fontFamily: font.regular, fontSize: 13, color: colors.white }}>
              <Text style={{ fontFamily: font.semibold, fontSize: 13, color: item.host ? '#FFC857' : '#B8AFFF' }}>{item.host ? `${item.name} (host) ` : `${item.name} `}</Text>
              {item.body}
            </Text>
          </View>
        )}
      />
      {err ? <Text style={{ color: '#FFB4B4', fontSize: 11.5 }}>{err}</Text> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <TextInput
          value={text}
          onChangeText={setText}
          onSubmitEditing={() => void go()}
          placeholder={placeholder}
          placeholderTextColor="rgba(255,255,255,0.55)"
          maxLength={300}
          returnKeyType="send"
          accessibilityLabel="Message likhein"
          style={{ flex: 1, height: 44, borderRadius: 22, paddingHorizontal: 16, color: colors.white, backgroundColor: 'rgba(0,0,0,0.42)', fontFamily: font.regular, fontSize: 14 }}
        />
        <Pressable onPress={() => void go()} accessibilityLabel="Bhejein" style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary }}>
          <Ionicons name="send" size={18} color={colors.white} />
        </Pressable>
      </View>
    </View>
  );
}
