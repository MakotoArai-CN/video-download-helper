import { afterEach, expect, spyOn, test } from 'bun:test';
import { BiliAPI } from '../src/api.ts';
import { Network } from '../src/network.ts';

afterEach(() => {
  BiliAPI.userVipType = 0;
});

test('有效的月度大会员可选择大会员清晰度', async () => {
  const fetchJSON = spyOn(Network, 'fetchJSON').mockResolvedValue({
    code: 0,
    data: { isLogin: true, vipStatus: 1, vipType: 1 }
  });

  try {
    expect(await BiliAPI.getUserInfo()).toBe(2);
    expect(BiliAPI.getAvailableQualities({ accept_quality: [127], accept_description: ['8K 超高清'] }))
      .toEqual([{ qn: 127, desc: '8K 超高清', available: true }]);
  } finally {
    fetchJSON.mockRestore();
  }
});
