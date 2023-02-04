import java.awt.*;
import java.applet.*;
import sun.audio.*;

// $Id: fourier.java,v 1.17 2000/03/25 20:42:13 manfred Exp $

/*
 * Copyright (c) 1996/1999/2000 Manfred Thole
 *      manfred@thole.org
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the
 * Free Software Foundation; either version 2 of the License, or (at your
 * option) any later version.
 * 
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License along
 * with this program; if not, write to the Free Software Foundation, Inc.,
 * 675 Mass Ave, Cambridge, MA 02139, USA.
 *
 *
 */

/**
    Fourier synthesis.
    @author Manfred Thole, manfred@thole.org
    @version $Date: 2000/03/25 20:42:13 $
  */

public class fourier extends Applet {
  // Max. |ak|,|bk|
  final static int MAX_AB = 50;
  // "k_max"
  final static int MAX_ANZ = 7;
  // a_k = a[k]/INT_MULT
  final static double INT_MULT = 10.0;
  // time base
  final static double TIM_MULT = 40.0/Math.PI;
  // Audio??
  final static boolean AUDIO = true;

  private int a [] = new int[MAX_ANZ];
  private int b [] = new int[MAX_ANZ];

  private Label la_a [] = new Label[MAX_ANZ];
  private Label la_b [] = new Label[MAX_ANZ];

  private Scrollbar s_a [] = new Scrollbar[MAX_ANZ];
  private Scrollbar s_b [] = new Scrollbar[MAX_ANZ];
  
  private Panel subPanel = new Panel();

  private Image bg;
  private Graphics bgg;

  private Image db;
  private Graphics dbg;

  private String sin_name;
  private String cos_name;

  private byte sound[] = new byte[40];
  private java.io.InputStream soundStream;
  private boolean soundOn;


  final static void gbcon(GridBagLayout gridbag, GridBagConstraints c,
			  Component cp, Panel p) {
    gridbag.setConstraints(cp, c);    
    p.add(cp);
  }


  public void init() {
    sin_name = this.getParameter("sin_name");
    if ( sin_name == null )
      sin_name = "Sinus:";
    if ( sin_name.length() > 21 )
      sin_name = sin_name.substring(0, 20);
    cos_name = this.getParameter("cos_name");
    if ( cos_name == null )
      cos_name = "Cosinus:";
    if ( cos_name.length() > 21 )
      cos_name = cos_name.substring(0, 20);
    bg = this.createImage(400,200);
    bgg = bg.getGraphics();
    bgg.setColor(Color.black);
    bgg.fillRect(0, 0, 400, 200);
    bgg.setColor(Color.green);
    for (int i = 0; i < 400; i+=4)
      bgg.drawLine(i, 100, i+1, 100);
    for (int i = 0; i < 200; i+=4)
      bgg.drawLine(200, i, 200, i+1);
    for (int i = 0; i < 400; i+=10)
      for (int j = 0; j < 200; j+=10)
	bgg.drawLine(i, j, i, j);
    db = this.createImage(400,200);
    dbg = db.getGraphics();
    dbg.drawImage(bg, 0, 0, null);
    //
    GridBagLayout gridbag = new GridBagLayout();
    subPanel.setLayout(gridbag);
    GridBagConstraints c = new GridBagConstraints();
    c.fill = GridBagConstraints.HORIZONTAL;
    c.anchor = GridBagConstraints.CENTER;
    c.weightx = 1.0;
    c.ipady = 0;
    //
    c.gridwidth = 2;
    gbcon(gridbag, c, new Label(cos_name), subPanel);
    c.gridwidth = GridBagConstraints.REMAINDER;
    gbcon(gridbag, c, new Label(sin_name), subPanel);
    //
    Insets insets1 = new Insets(0, 10, 0, 0);
    Insets insets2 = new Insets(0, 0, 0, 10);
    for (int i=0; i < MAX_ANZ; i++)
      {
	c.gridwidth = 1;
	la_a[i] = new Label("a" + i + ": " + a[i]/INT_MULT);
	c.ipadx = 15;
	c.insets = insets1;
	gbcon(gridbag, c, add(la_a[i]), subPanel);
	s_a[i] = new Scrollbar(Scrollbar.HORIZONTAL,a[i],1,-MAX_AB,MAX_AB);
	c.ipadx = 50;
	c.insets = insets2;
	gbcon(gridbag, c, add(s_a[i]), subPanel);
	if ( i == 0 )
	  {
	    c.gridwidth = GridBagConstraints.REMAINDER;
	    gbcon(gridbag, c, new Label(""), subPanel);
	  }
	else
	  {
	    la_b[i] = new Label("b" + i + ": " + b[i]/INT_MULT);
	    c.ipadx = 15;
	    c.insets = insets1;
	    gbcon(gridbag, c, add(la_b[i]), subPanel);
	    s_b[i] = new Scrollbar(Scrollbar.HORIZONTAL,b[i],1,-MAX_AB,MAX_AB);
	    c.gridwidth = GridBagConstraints.REMAINDER;
	    c.ipadx = 50;
	    c.insets = insets2;
	    gbcon(gridbag, c, add(s_b[i]), subPanel);
	  }
      }
    if ( AUDIO )
      soundStream = new ContinuousAudioDataStream(new AudioData(sound));
    plot();
    if ( AUDIO )
      soundOn = true;
    subPanel.resize(400,200);
    add(subPanel);
    resize(400,400);
  }

  public static byte int2ulaw(int ch) {
    int mask;

    if (ch < 0) {
      ch = -ch;
      mask = 0x7f;
    }
    else {
      mask = 0xff;
    }
    //
    if (ch < 32) {
      ch = 0xF0 | 15 - (ch/2);
    }
    else
      if (ch < 96) {
	ch = 0xE0 | 15 - (ch-32)/4;
      }
      else
	if (ch < 224) {
	  ch = 0xD0 | 15 - (ch-96)/8;
	}
	else
	  if (ch < 480) {
	    ch = 0xC0 | 15 - (ch-224)/16;
	  }
	  else
	    if (ch < 992 ) {
	      ch = 0xB0 | 15 - (ch-480)/32;
	    }
	    else
	      if (ch < 2016) {
		ch = 0xA0 | 15 - (ch-992)/64;
	      }
	      else
		if (ch < 4064) {
		  ch = 0x90 | 15 - (ch-2016)/128;
		}
		else
		  if (ch < 8160) {
		    ch = 0x80 | 15 - (ch-4064)/256;
		  }
		  else {
		    ch = 0x80;
		  }
    return (byte)(mask & ch);
  }

  private final void plot() {
    int ya = 0;
    int yf = 0;

    dbg.drawImage(bg, 0, 0, null);
    dbg.setColor(Color.green);
    if ( AUDIO && soundOn )
      AudioPlayer.player.stop(soundStream);
    // One period, TIM_MULT dependent! This needs clean up...
    for (int i = 0; i < 80; i++)
      {
	double y = 0;
	y += a[0]/(2.0*INT_MULT);
	for (int j = 1; j < MAX_ANZ; j++)
	  {
	    y += a[j]/INT_MULT*Math.cos(j*i/TIM_MULT);
	    y += b[j]/INT_MULT*Math.sin(j*i/TIM_MULT);
	  }
	int iy = (int) (100-y*10);
	if ( AUDIO && ( i % 2 != 0 ) )
	  sound[i/2] = int2ulaw((int)(y*100));
	if ( i == 0 )
	  {
	    yf = iy;
	    ya = iy;
	  }
	else
	  {
	    for (int j = 0; j < 400; j += 80)
	      dbg.drawLine(i-1+j, ya, i+j, iy);
	    ya = iy;
	  }
      }
    if ( AUDIO && soundOn )
      AudioPlayer.player.start(soundStream);
    for (int j = 80; j < 400; j+=80)
      dbg.drawLine(j-1, ya, j, yf);
  }

  public boolean mouseDown(Event e, int x, int y) {
    if ( !AUDIO || ( y < 199 ) )
      return super.mouseDown(e, x, y);
    if ( soundOn )
      {
	AudioPlayer.player.stop(soundStream);
	showStatus("Audio OFF");
      }
    else
      {
	AudioPlayer.player.start(soundStream);
	showStatus("Audio ON");
      }
    soundOn = !soundOn;
    return true;
  }

  public boolean handleEvent(Event e) {
    if (e.target instanceof Scrollbar) {
      int value = ((Scrollbar)e.target).getValue();
      for (int i=0; i < MAX_ANZ; i++)
	{
	  if ( e.target.equals(s_a[i]) ) 
	    { 
	      a[i] = value;
	      la_a[i].setText("a" + i + ": " + a[i]/INT_MULT);
	      break;
	    }
	  if ( ( i != 0 ) &&  ( e.target.equals(s_b[i]) ) ) 
	    {
	      b[i] = value;
	      la_b[i].setText("b" + i + ": " + b[i]/INT_MULT);
	      break;
	    }
	}
      repaint();
      return true;
    }
    return super.handleEvent(e);
  } 

  public void update(Graphics g) {
    plot();
    paint(g);
  }

  public void paint(Graphics g) {
    g.drawImage(db, 0, 200, null);
  }

  public void stop() {
     if ( AUDIO && soundOn )
	AudioPlayer.player.stop(soundStream);
  }

  public void start() {
     if ( AUDIO && soundOn )
	AudioPlayer.player.start(soundStream);
  }

  public void destroy() {
    if ( AUDIO )
      AudioPlayer.player.stop(soundStream);
    for (int i=0; i < MAX_ANZ; i++)
      {
	a[i] = 0;
	b[i] = 0;
	la_a[i] = null;
	la_b[i] = null;
	s_a[i] = null;
	s_b[i] = null;
      }
    subPanel.removeAll();
    removeAll();
    bg.flush();
    db.flush();
  }

  public String getAppletInfo()
    {
      return "fourier.class $Date: 2000/03/25 20:42:13 $,\n" +
             "Copyright (C) 1996/1999/2000 Manfred Thole, manfred@thole.org\n" +
	     "\n" +
	     "This program is free software; you can redistribute it and/or modify it\n" +
             "under the terms of the GNU General Public License as published by the\n" +
             "Free Software Foundation; either version 2 of the License, or (at your\n" +
             "option) any later version.\n" +
             "\n" +
             "This program is distributed in the hope that it will be useful, but\n" +
             "WITHOUT ANY WARRANTY; without even the implied warranty of\n" +
             "MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU\n" +
             "General Public License for more details.\n" +
             "\n" +
             "You should have received a copy of the GNU General Public License along\n" +
             "with this program; if not, write to the Free Software Foundation, Inc.,\n" +
             "675 Mass Ave, Cambridge, MA 02139, USA.\n";
    }

  public String[][] getParameterInfo() {
    String[][] info = { { "sin_name", "String", "Sine: / Sinus: / ..." },
			{ "cos_name", "String", "Cosine: / Cosinus: / ..." }
		      };
    return info;
  } 
}
