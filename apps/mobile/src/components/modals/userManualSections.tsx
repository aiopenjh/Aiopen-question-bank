/**
 * 사용설명서 각 항목의 고정 콘텐츠.
 * props/state에 의존하지 않는 순수 정적 데이터라서 모듈 스코프 상수로 한 번만 만든다.
 * UserManualModal.tsx 안에서 매 렌더(항목 펼침/접힘 토글마다)마다 이 트리 전체를
 * 다시 생성하면, 안드로이드 저사양 기기에서 탭할 때마다 버벅이거나 반응이 늦어진다.
 */
import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { colors } from '../../styles/designTokens';

export interface UserManualSection {
  id: string;
  icon: string;
  title: string;
  subtitle: string;
  content: React.ReactNode;
}

// USER_MANUAL_SECTIONS의 JSX가 아래 style을 참조하므로, 모듈 평가 순서상
// styles를 먼저 선언해야 한다(반대 순서면 styles가 아직 초기화되지 않은
// 상태로 참조되어 TDZ 오류가 난다).
const styles = StyleSheet.create({
  detailContainer: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 2,
  },
  tipBox: {
    backgroundColor: 'transparent',
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cautionBox: {
    backgroundColor: '#fef2f2',
    borderBottomColor: '#fecaca',
    marginHorizontal: -10,
    paddingHorizontal: 10,
  },
  tipTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.ink,
    marginBottom: 4,
  },
  tipText: {
    fontSize: 11.5,
    color: '#4b5563',
    lineHeight: 18,
  },
  bold: {
    fontWeight: 'bold',
    color: '#1f2937',
  },
});

export const USER_MANUAL_SECTIONS: UserManualSection[] = [
  {
    id: 'start',
    icon: '✨',
    title: '처음 시작 & 문제 출제',
    subtitle: 'AI 연결, 과목 생성, 첫 문제 풀이까지',
    content: (
      <View style={styles.detailContainer}>
        <View style={styles.tipBox}>
          <Text style={styles.tipTitle}>🔑 1. AI 연결하기</Text>
          <Text style={styles.tipText}>
            • <Text style={styles.bold}>[설정 ➔ AI 연결]</Text>을 열고 Google Gemini, Anthropic Claude 또는 OpenAI의 본인 API 키를 저장합니다.{'\n'}
            • 키는 학습 데이터와 분리해 현재 기기에 보관하며 일반 백업에는 포함하지 않습니다. 연결되지 않으면 가짜 문제를 대신 만들지 않고 설정 안내를 표시합니다.
          </Text>
        </View>

        <View style={styles.tipBox}>
          <Text style={styles.tipTitle}>🧩 2. 새 학습 과목 만들기</Text>
          <Text style={styles.tipText}>
            • 메인 중앙의 <Text style={styles.bold}>[배우고 싶은 주제를 자유롭게 입력하세요]</Text> 또는 자료함의 <Text style={styles.bold}>[+ 과목 추가]</Text>를 누릅니다. 과목 이름, 분류, 시작 레벨을 정하면 첫 5개 단원이 만들어집니다.{'\n'}
            • 시험 과목뿐 아니라 커피 로스팅, 게임 세계관, 바람 잘 피하기처럼 취미·생활·엉뚱한 아이디어도 학습 주제로 사용할 수 있습니다.{'\n'}
            • 자료를 먼저 등록했다면 <Text style={styles.bold}>[내 파일 불러오기]</Text>에서 연결할 수 있습니다. 분류는 선택 사항이며 직접 입력하거나 추천 분류를 고르면 됩니다.
          </Text>
        </View>

        <View style={styles.tipBox}>
          <Text style={styles.tipTitle}>📝 3. 문제 만들고 풀기</Text>
          <Text style={styles.tipText}>
            • 자료함에서 과목을 열고 단원의 <Text style={styles.bold}>[새 문제 만들기]</Text>를 누른 뒤 레벨과 3문제 또는 5문제를 선택합니다. 저장된 문제는 <Text style={styles.bold}>[기존 문제 풀기]</Text>로 AI 호출 없이 바로 시작합니다.{'\n'}
            • 문제 순서와 객관식 정답 위치는 코드에서 무작위로 분산합니다. 출제 중 취소하면 진행 중인 요청과 저장을 중단합니다. 요청 한도(429)가 나오면 안내된 시간 뒤 다시 시도해 주세요.
          </Text>
        </View>

        <View style={styles.tipBox}>
          <Text style={styles.tipTitle}>🏛️ 4. 최신 세율·법령 문제</Text>
          <Text style={styles.tipText}>
            • 세율, 부동산법, 법령처럼 바뀔 수 있는 주제는 출제할 때 공식 정부 자료를 검색해 현재 시행 중인 내용만 사용합니다.{`\n`}
            • 풀이 결과와 문제 보관함에서 기준일, 공식 기관과 원문 링크를 확인할 수 있습니다.{`\n`}
            • 공식 근거를 확인하지 못하면 문제를 임의로 만들지 않고 출제를 중단합니다. 이 기능을 지원하는 AI 연결이 필요합니다.
          </Text>
        </View>
      </View>
    ),
  },
  {
    id: 'upload',
    icon: '📁',
    title: '교재 업로드 가이드',
    subtitle: '상단 + 자료 등록과 과목 연결 방법',
    content: (
      <View style={styles.detailContainer}>
        <View style={styles.tipBox}>
          <Text style={styles.tipTitle}>📲 1. 자료 먼저 등록하기</Text>
          <Text style={styles.tipText}>
            • 화면 상단의 <Text style={styles.bold}>[+ 자료]</Text>에서 파일 또는 텍스트 자료를 등록합니다. 등록한 자료는 새 과목을 만들 때 <Text style={styles.bold}>[내 파일 불러오기]</Text>에서 선택합니다.{'\n'}
            • 스마트폰에서는 다운로드 폴더뿐 아니라 Google Drive, OneDrive 등 기기의 파일 선택 화면에 연결된 위치에서도 불러올 수 있습니다.
          </Text>
        </View>

        <View style={styles.tipBox}>
          <Text style={styles.tipTitle}>📑 2. 추천 파일 형식</Text>
          <Text style={styles.tipText}>
            • <Text style={styles.bold}>TXT, MD, CSV, JSON</Text>: 실제 본문을 읽어 등록하므로 문제 출제 자료로 가장 적합합니다.{'\n'}
            • <Text style={styles.bold}>ZIP</Text>: 압축 안의 TXT, MD, CSV, JSON 텍스트 파일을 함께 불러옵니다.{'\n'}
            • <Text style={styles.bold}>PDF</Text>: 선택한 페이지를 목차·문제 생성 요청에 전달합니다. PDF 분석을 지원하는 AI 연결이 필요하며 파일 원본과 전체 본문은 저장하지 않습니다.{'\n'}
            • 텍스트 자료는 다시 사용할 수 있지만, 앱을 다시 연 뒤 PDF를 사용할 때는 보안을 위해 같은 원본 파일을 다시 선택해야 합니다.{'\n'}
            • 30페이지가 넘는 PDF는 10~20페이지씩 나누고, 문제도 한 번에 3~5문항씩 생성하는 것을 권장합니다. 하루 누적 15문항을 넘기면 무료 할당량 소진이나 429 제한이 발생할 수 있습니다.
          </Text>
        </View>

        <View style={[styles.tipBox, styles.cautionBox]}>
          <Text style={[styles.tipTitle, { color: '#991b1b' }]}>⚠️ 3. 한글 문서(.hwp, .hwpx) 주의사항</Text>
          <Text style={[styles.tipText, { color: '#7f1d1d' }]}>
            • 한글 문서는 현재 앱이 본문을 직접 읽지 못합니다.{'\n'}
            • 한글 프로그램에서 <Text style={styles.bold}>[파일 ➔ 다른 이름으로 저장 ➔ PDF 또는 텍스트(.txt)]</Text>로 변환하신 후 첨부해 주세요.
          </Text>
        </View>
      </View>
    ),
  },
  {
    id: 'curriculum',
    icon: '🎯',
    title: '자료함 & 단계별 목차',
    subtitle: '과목 선택, 단원 확장과 난이도 관리',
    content: (
      <View style={styles.detailContainer}>
        <View style={styles.tipBox}>
          <Text style={styles.tipTitle}>📚 1. 과목과 문제 찾기</Text>
          <Text style={styles.tipText}>
            • 자료함 상단에서 전체 또는 분류를 선택한 뒤 과목 카드를 눌러 단원 목록을 엽니다. 각 단원에는 보관 문항 수와 <Text style={styles.bold}>[기존 문제 풀기] / [새 문제 만들기]</Text>가 표시됩니다.{'\n'}
            • 과목의 문제 보관함에서는 출제한 문제를 단원별로 확인하고 필요한 문제를 오답노트에 저장할 수 있습니다.
          </Text>
        </View>

        <View style={styles.tipBox}>
          <Text style={styles.tipTitle}>🪜 2. 목차를 5개씩 확장하기</Text>
          <Text style={styles.tipText}>
            • 학습량이 한꺼번에 몰리지 않도록 목차는 5개 단위의 작은 단계로 구성됩니다. 현재 단계를 마친 뒤 <Text style={styles.bold}>[다음 5개 단원 생성]</Text>으로 30단원 이후까지 계속 확장할 수 있습니다.{'\n'}
            • 이미 존재하는 단원과 비슷한 이름은 정리하고, 같은 단원에 문제를 추가할 때도 기존 문항과 지나치게 유사하면 저장하지 않습니다.
          </Text>
        </View>

        <View style={styles.tipBox}>
          <Text style={styles.tipTitle}>🎯 3. 문제 난이도 레벨 선택</Text>
          <Text style={styles.tipText}>
            • <Text style={styles.bold}>레벨 1~10</Text>: 필수 용어와 핵심 차이를 작은 간격으로 익힙니다.{'\n'}
            • <Text style={styles.bold}>레벨 11~20</Text>: 기본 적용에서 응용 판단까지 점진적으로 넓힙니다.{'\n'}
            • <Text style={styles.bold}>레벨 21~30</Text>: 세부 조건, 오개념 판별, 종합 추론을 다룹니다.{'\n'}
            • <Text style={styles.bold}>레벨 31 이상</Text>: 매번 새로 생성한 3문제로 도전하며 2문제 이상 맞히면 다음 레벨이 열립니다. 기존 문제 재풀이는 복습으로만 남고 순차 통과와 초고난도 랭킹에는 반영되지 않습니다.{'\n'}
            • <Text style={styles.bold}>단원별 레벨 유지</Text>: 첫 출제는 과목의 시작 레벨을 사용합니다. 이후 원하는 레벨을 고르고 3문제 또는 5문제를 누른 뒤 변경 방식을 선택하면 해당 단원에 저장되어 앱을 다시 열어도 유지됩니다.{'\n'}
            • <Text style={styles.bold}>문제 유지·삭제</Text>: <Text style={styles.bold}>기존문제유지 + 레벨변경</Text>은 새 문제를 누적하고, <Text style={styles.bold}>기존문제삭제 + 레벨변경</Text>은 새 문제 저장이 성공한 뒤 해당 단원의 이전 문제만 삭제합니다. 취소하거나 설정창을 닫으면 선택한 레벨은 저장되지 않습니다.
          </Text>
        </View>
      </View>
    ),
  },
  {
    id: 'exam',
    icon: '📝',
    title: 'CBT & 오답노트 활용법',
    subtitle: '시험, 해설, 복습 예정과 오답노트',
    content: (
      <View style={styles.detailContainer}>
        <View style={styles.tipBox}>
          <Text style={styles.tipTitle}>📝 1. CBT 시험과 결과 확인</Text>
          <Text style={styles.tipText}>
            • 답을 고른 뒤 제출하면 점수와 문항별 정답, 오답 원인, 핵심 개념, 풀이 과정을 확인할 수 있습니다. 미답변 문항이 있으면 제출 전에 다시 알려줍니다.{'\n'}
            • 저장된 전용 힌트가 없는 문제는 <Text style={styles.bold}>[AI 힌트 만들기]</Text>를 눌렀을 때만 생성합니다. 만들어진 힌트는 해당 문제에 저장되어 다시 사용할 수 있습니다.
          </Text>
        </View>

        <View style={styles.tipBox}>
          <Text style={styles.tipTitle}>⭐ 2. 복습 예정과 나만의 오답노트</Text>
          <Text style={styles.tipText}>
            • 틀린 문제는 메인의 <Text style={styles.bold}>[복습 예정]</Text>에서 다시 확인할 수 있습니다. 직접 오래 보관할 문제는 문제 보관함에서 <Text style={styles.bold}>[오답노트 저장]</Text>을 누릅니다.{'\n'}
            • 메인의 <Text style={styles.bold}>[나만의 오답노트]</Text>에서는 직접 고른 문제만 과목별로 모아 집중 복습하고 필요하면 보관을 해제할 수 있습니다.
          </Text>
        </View>

        <View style={styles.tipBox}>
          <Text style={styles.tipTitle}>✅ 3. 과목 전체 CBT와 삭제</Text>
          <Text style={styles.tipText}>
            • 다음 목차 단계로 넘어가기 전 지금까지 해당 과목에 저장한 문제를 전체 CBT로 총정리할 수 있습니다. 시험을 마치면 자료함으로 돌아옵니다.{'\n'}
            • 과목과 단원 삭제는 해당 카드의 삭제 버튼에서 실행합니다. 삭제한 학습 데이터는 복구할 수 없으므로 먼저 백업하세요.
          </Text>
        </View>
      </View>
    ),
  },
  {
    id: 'settings',
    icon: '⚙️',
    title: '학습 목표 & 알림 설정',
    subtitle: '목표, 다중 알람과 접이식 설정 관리',
    content: (
      <View style={styles.detailContainer}>
        <View style={styles.tipBox}>
          <Text style={styles.tipTitle}>🎯 1. 일일 학습 목표 저장</Text>
          <Text style={styles.tipText}>
            • <Text style={styles.bold}>[설정 ➔ 학습 루틴]</Text>에서 1~30 사이의 목표 문항 수를 입력하거나 화살표로 조절합니다.{'\n'}
            • 숫자를 바꾸면 별도의 저장 버튼 없이 메인 화면의 일일 달성 기준에 바로 반영됩니다.
          </Text>
        </View>

        <View style={styles.tipBox}>
          <Text style={styles.tipTitle}>⏰ 2. 원하는 시간에 학습 알림</Text>
          <Text style={styles.tipText}>
            • 공통 요일을 고른 뒤 <Text style={styles.bold}>07:20, 13:00, 22:15</Text>처럼 분 단위 알람을 최대 8개까지 추가할 수 있습니다.{'\n'}
            • 시간 카드를 누르면 시각을 수정하고 ×를 누르면 개별 삭제합니다. 기기 또는 브라우저의 알림 권한이 허용되어야 합니다.{'\n'}
            • 알림을 누르면 앱으로 이동하지만 단원이나 문제를 자동 시작하지 않습니다. 자료함에서 원하는 학습 대상을 직접 선택하세요.
          </Text>
        </View>

        <View style={styles.tipBox}>
          <Text style={styles.tipTitle}>↻ 3. 화면 새로고침</Text>
          <Text style={styles.tipText}>
            • 메인, 자료함, 설정 화면의 맨 위에서 아래로 당기면 저장된 최신 학습 데이터를 다시 불러옵니다.
          </Text>
        </View>

        <View style={styles.tipBox}>
          <Text style={styles.tipTitle}>⌄ 4. AI 연결과 데이터 관리</Text>
          <Text style={styles.tipText}>
            • 설정 화면은 필요한 항목만 펼쳐 쓰도록 구성되어 있습니다. <Text style={styles.bold}>[AI 연결]</Text>에서 키 상태를 관리하고, <Text style={styles.bold}>[데이터 관리]</Text>에서 백업·복원·초기화를 실행합니다. 행의 어느 곳을 눌러도 열고 닫을 수 있습니다.
          </Text>
        </View>

        <View style={styles.tipBox}>
          <Text style={styles.tipTitle}>↻ 5. 최신 버전 확인</Text>
          <Text style={styles.tipText}>
            • 설정 맨 아래의 <Text style={styles.bold}>[갱신]</Text>을 누르면 서버의 최신 버전을 확인합니다.{`\n`}
            • 새 화면이 바로 보이지 않으면 브라우저나 홈 화면 앱을 완전히 종료한 뒤 다시 열어 주세요.
          </Text>
        </View>
      </View>
    ),
  },
  {
    id: 'ranking',
    icon: '🏆',
    title: '랭킹 참여 & 자동 연동',
    subtitle: '닉네임 등록, 세 가지 랭킹과 계정 복구',
    content: (
      <View style={styles.detailContainer}>
        <View style={styles.tipBox}>
          <Text style={styles.tipTitle}>🏷️ 1. 처음 한 번 참여 등록</Text>
          <Text style={styles.tipText}>
            • 메인·자료함·설정 상단의 랭킹 버튼을 누르고 공개 닉네임 2~12자를 등록합니다. 참여하지 않아도 다른 학습 기능에는 영향이 없습니다.{`\n`}
            • 다른 사용자가 쓰는 닉네임은 중복 등록할 수 없습니다. 욕설, 성적 표현, 관리자·운영자 사칭어와 공백·기호를 이용한 우회 표현도 서버에서 거부합니다.
          </Text>
        </View>

        <View style={styles.tipBox}>
          <Text style={styles.tipTitle}>🔄 2. 시험 완료 후 자동 연동</Text>
          <Text style={styles.tipText}>
            • 한 번 등록하면 별도의 연동 버튼 없이 시험을 마칠 때 <Text style={styles.bold}>최다 문제 풀이, 꾸준함, 초고난도 도전</Text> 기록이 함께 전송됩니다.{`\n`}
            • 하루 3문제 이상 완료하면 꾸준함 기록에 반영됩니다. 한 사용자가 세 랭킹에 동시에 표시될 수 있습니다.{`\n`}
            • 문제 내용, 정답, 과목명과 API 키는 전송하지 않습니다. 네트워크 실패 기록은 기기에 대기했다가 다음 시험 완료 때 다시 전송합니다.
          </Text>
        </View>

        <View style={styles.tipBox}>
          <Text style={styles.tipTitle}>🛡️ 3. 복구와 탈퇴</Text>
          <Text style={styles.tipText}>
            • 랭킹 계정 복구 정보는 <Text style={styles.bold}>전체 백업</Text>에만 포함되므로 다른 사람에게 전달하지 말고 안전하게 보관하세요.{`\n`}
            • 기기를 바꿀 때는 설정에서 전체 백업을 복원하세요. 랭킹 창을 열면 백업에서 발견한 기존 랭킹 계정을 이어서 사용할 수 있습니다.{`\n`}
            • 다른 기기에서 새 닉네임을 등록하면 기존 기록과 분리됩니다. 탈퇴 요청 시 닉네임은 즉시 랭킹에서 숨겨지고 3일 후 서버 기록이 삭제됩니다. 3일 안에 복구하면 탈퇴 요청이 취소됩니다.
          </Text>
        </View>
      </View>
    ),
  },
  {
    id: 'backup',
    icon: '💾',
    title: '백업 & 데이터 보안',
    subtitle: '로컬 저장, 백업·복원과 앱 초기화',
    content: (
      <View style={styles.detailContainer}>
        <View style={styles.tipBox}>
          <Text style={styles.tipTitle}>🔒 1. 로컬 학습 데이터</Text>
          <Text style={styles.tipText}>
            • Celueste는 외부 중앙 서버에 사용자의 개인 문제, 정답, 과목명이나 교재 본문을 수집하지 않습니다. 선택형 랭킹은 공개 닉네임과 순위 계산에 필요한 최소 기록만 처리합니다.{'\n'}
            • 웹에서는 과목, 단원, 문제와 풀이 기록을 현재 기기의 개인 IndexedDB에 자동 보관합니다. 별도로 DB를 만들거나 설정할 필요가 없습니다. 브라우저 데이터 삭제나 앱 초기화 전에는 백업 파일을 만들어 두세요.
          </Text>
        </View>

        <View style={styles.tipBox}>
          <Text style={styles.tipTitle}>💾 2. 스마트폰 변경 시 데이터 이동 방법</Text>
          <Text style={styles.tipText}>
            • <Text style={styles.bold}>[내 문제집 내보내기]</Text>에서 과목과 정답·해설 포함 여부를 고른 뒤 [PDF 파일 바로 저장]을 누릅니다. [PDF 저장 화면 열기]는 저장 전 배치를 확인하는 미리보기이며 오른쪽 위 ×로 돌아옵니다. 단원별 문제 번호는 1번부터 시작합니다.{'\n'}
            • <Text style={styles.bold}>[백업하기 → 문제만 백업]</Text>은 과목·단원·문제만 저장합니다. 다른 기기에서 복원해도 기존 풀이·복습·교재·설정은 유지됩니다.{'\n'}
            • <Text style={styles.bold}>[백업하기 → 전체 백업]</Text>은 기기 이전과 장애 복구용입니다. 풀이·복습·교재·설정과 랭킹 계정 복구 정보를 함께 저장하고, 복원하면 현재 학습 데이터를 교체합니다.{`\n`}
            • API 키는 어느 백업에도 포함되지 않습니다. 새 기기에서는 직접 다시 등록해야 하며, 전체 백업은 다른 사람에게 전달하지 말고 안전하게 보관하세요.
          </Text>
        </View>

        <View style={styles.tipBox}>
          <Text style={styles.tipTitle}>📱 3. 홈 화면에 앱 아이콘 추가</Text>
          <Text style={styles.tipText}>
            • Android Chrome은 메뉴의 <Text style={styles.bold}>[홈 화면에 추가]</Text>, iPhone Safari는 공유 메뉴의 <Text style={styles.bold}>[홈 화면에 추가]</Text>를 사용합니다.{'\n'}
            • 이전 바로가기가 기본 아이콘으로 보이면 기존 바로가기를 삭제한 뒤 다시 추가하세요.
          </Text>
        </View>

        <View style={styles.tipBox}>
          <Text style={styles.tipTitle}>⚠️ 4. 학습 데이터 삭제 방법</Text>
          <Text style={styles.tipText}>
            • 가장 확실한 방법은 앱의 <Text style={styles.bold}>[설정 ➔ 데이터 관리 ➔ 전체 데이터 초기화]</Text>를 먼저 실행한 뒤 홈 화면 아이콘을 삭제하는 것입니다. 과목, 단원, 문제, 풀이 기록과 등록한 API 키가 함께 삭제되며 복구할 수 없습니다.{'\n'}
            • 추후 문제은행 복구를 원하시면 전체 초기화 전에 <Text style={styles.bold}>[백업하기]</Text>에서 백업 데이터를 저장해 두시길 권장합니다.{'\n'}
            • 홈 화면 아이콘만 삭제하는 것으로는 학습 데이터 삭제가 보장되지 않습니다. 같은 브라우저에서 기존 주소를 다시 열면 데이터가 남아 있을 수 있습니다.{'\n'}
            • 앱에서 초기화하지 못한 경우에는 Android Chrome 또는 iPhone Safari 설정의 <Text style={styles.bold}>웹사이트 데이터</Text>에서 <Text style={styles.bold}>aiopenjh.github.io</Text> 항목을 삭제하세요.
          </Text>
        </View>
      </View>
    ),
  },
];
